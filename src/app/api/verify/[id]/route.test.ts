import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import { StatusConflictError } from '@/domain/repositories/logistics.repository';
import type { AuthState } from '@/infrastructure/auth/session';

const mocks = vi.hoisted(() => ({
  getAuthState: vi.fn<() => Promise<AuthState>>(),
  findById: vi.fn<(id: string) => Promise<LogisticsRequest | null>>(),
  saveDecision: vi.fn<(request: LogisticsRequest) => Promise<LogisticsRequest>>(),
}));

vi.mock('@/infrastructure/auth/session', () => ({
  getAuthState: mocks.getAuthState,
}));

vi.mock('@/infrastructure/database/postgis-logistics.repository', () => ({
  PostgisLogisticsRepository: class {
    findById = mocks.findById;
    saveDecision = mocks.saveDecision;
  },
}));

const { PATCH } = await import('./route');

const REQUEST_ID = '0b6f1c1e-5b9a-4a8e-9a43-2b7c5f0e9d11';
const VERIFIER_ID = '7d1c2f0a-1b2c-4d3e-8f9a-0b1c2d3e4f5a';
const HOST = 'mapa.example.org';

const VERIFIER_STATE: AuthState = {
  kind: 'verifier',
  verifier: { userId: VERIFIER_ID, email: 'equipo@example.org', role: 'verificador' },
};

function pendingRequest(): LogisticsRequest {
  return LogisticsRequest.fromPrimitives({
    id: REQUEST_ID,
    contact: { fullName: 'Juan Mamani', phone: '987654321', region: 'Puno', district: 'Juliaca' },
    latitude: -15.5,
    longitude: -70.13,
    categories: ['agua'],
    urgency: 'critico',
    description: 'Sin agua potable',
    status: 'pendiente',
    createdAt: '2026-10-15T12:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
  });
}

function patch(
  body: unknown,
  { id = REQUEST_ID, origin = `https://${HOST}` }: { id?: string; origin?: string | null } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json', host: HOST };
  if (origin !== null) headers.origin = origin;
  const request = new NextRequest(`https://${HOST}/api/verify/${id}`, {
    method: 'PATCH',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return PATCH(request, { params: Promise.resolve({ id }) });
}

describe('PATCH /api/verify/[id]', () => {
  beforeEach(() => {
    mocks.getAuthState.mockReset().mockResolvedValue(VERIFIER_STATE);
    mocks.findById.mockReset().mockResolvedValue(pendingRequest());
    mocks.saveDecision.mockReset().mockImplementation(async (request) => request);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('responde 401 sin sesión', async () => {
    mocks.getAuthState.mockResolvedValue({ kind: 'anonymous' });
    const res = await patch({ status: 'verificado' });
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.saveDecision).not.toHaveBeenCalled();
  });

  it('responde 403 si el usuario no es verificador', async () => {
    mocks.getAuthState.mockResolvedValue({ kind: 'forbidden', userId: VERIFIER_ID });
    const res = await patch({ status: 'verificado' });
    expect(res.status).toBe(403);
    expect(mocks.findById).not.toHaveBeenCalled();
    expect(mocks.saveDecision).not.toHaveBeenCalled();
  });

  it.each([
    ['otro origen', 'https://atacante.example.com'],
    ['sin Origin', null],
    ['Origin malformado', 'no-es-una-url'],
  ])('responde 403 con %s, sin consultar la sesión', async (_label, origin) => {
    const res = await patch({ status: 'verificado' }, { origin });
    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.getAuthState).not.toHaveBeenCalled();
    expect(mocks.saveDecision).not.toHaveBeenCalled();
  });

  it('responde 400 con un id que no es UUID', async () => {
    const res = await patch({ status: 'verificado' }, { id: 'abc' });
    expect(res.status).toBe(400);
    expect(mocks.findById).not.toHaveBeenCalled();
  });

  it.each([
    ['JSON inválido', '{no json'],
    ['status desconocido', { status: 'aprobado' }],
    ['rechazo sin motivo', { status: 'rechazado' }],
    ['motivo demasiado corto', { status: 'rechazado', reason: ' a ' }],
    ['motivo demasiado largo', { status: 'rechazado', reason: 'x'.repeat(301) }],
    ['pendiente', { status: 'pendiente' }],
  ])('responde 400 con body inválido (%s)', async (_label, body) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(mocks.saveDecision).not.toHaveBeenCalled();
  });

  it('responde 404 si la solicitud no existe', async () => {
    mocks.findById.mockResolvedValue(null);
    const res = await patch({ status: 'verificado' });
    expect(res.status).toBe(404);
  });

  it('responde 409 si ya no está pendiente', async () => {
    mocks.findById.mockResolvedValue(pendingRequest().verify(VERIFIER_ID, new Date()));
    const res = await patch({ status: 'rechazado', reason: 'Duplicada' });
    expect(res.status).toBe(409);
    expect(mocks.saveDecision).not.toHaveBeenCalled();
  });

  it('responde 409 si pierde la carrera al guardar', async () => {
    mocks.saveDecision.mockRejectedValue(new StatusConflictError(REQUEST_ID));
    const res = await patch({ status: 'verificado' });
    expect(res.status).toBe(409);
  });

  it('responde 200 al aprobar y guarda el verificador de la sesión', async () => {
    const res = await patch({ status: 'verificado' });

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as Record<string, string>;
    expect(body).toMatchObject({ id: REQUEST_ID, status: 'verificado' });
    expect(JSON.stringify(body)).not.toContain('987654321');

    const saved = mocks.saveDecision.mock.calls[0][0];
    expect(saved.status).toBe('verificado');
    expect(saved.verifiedBy).toBe(VERIFIER_ID);
  });

  it('responde 200 al rechazar con el motivo recortado', async () => {
    const res = await patch({ status: 'rechazado', reason: '  Número inexistente  ' });
    expect(res.status).toBe(200);
    const saved = mocks.saveDecision.mock.calls[0][0];
    expect(saved.status).toBe('rechazado');
    expect(saved.rejectionReason).toBe('Número inexistente');
  });

  it('responde 500 genérico ante errores internos', async () => {
    mocks.findById.mockRejectedValue(new Error('Error al obtener la solicitud: secreto'));
    const res = await patch({ status: 'verificado' });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secreto');
  });

  it('responde 500 genérico si falla la comprobación de sesión', async () => {
    mocks.getAuthState.mockRejectedValue(new Error('Error al consultar verificadores: secreto'));
    const res = await patch({ status: 'verificado' });
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secreto');
  });
});
