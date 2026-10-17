import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { LogisticsRequest } from '@/domain/entities/logistics-request.entity';

const mocks = vi.hoisted(() => ({
  save: vi.fn<(request: LogisticsRequest) => Promise<LogisticsRequest>>(),
  getVerified: vi.fn<() => Promise<LogisticsRequest[]>>(),
  consume: vi.fn<
    (bucket: string, limit: number, windowSeconds: number) => Promise<{
      allowed: boolean;
      retryAfterSeconds: number;
    }>
  >(),
  getResponseTeamWhatsApp: vi.fn<() => string>(),
}));

vi.mock('@/infrastructure/database/postgis-logistics.repository', () => ({
  PostgisLogisticsRepository: class {
    save = mocks.save;
    getVerified = mocks.getVerified;
  },
}));

vi.mock('@/infrastructure/database/rate-limiter.repository', () => ({
  SupabaseRateLimiter: class {
    consume = mocks.consume;
  },
}));

vi.mock('@/infrastructure/config/response-team', () => ({
  getResponseTeamWhatsApp: mocks.getResponseTeamWhatsApp,
}));

const { POST } = await import('./route');

const TEAM_PHONE = '51912345678';
const REQUESTER_PHONE = '987654321';

const VALID_BODY = {
  fullName: 'Rosa Huamán',
  phone: REQUESTER_PHONE,
  region: 'Cusco',
  district: 'Urubamba',
  latitude: -13.3,
  longitude: -72.1,
  categories: ['agua'],
  urgency: 'critico',
  description: 'Faltan bidones de agua en la comunidad',
};

function postRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/logistics', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.9', ...headers },
    body,
  });
}

describe('POST /api/logistics', () => {
  beforeEach(() => {
    mocks.save.mockReset().mockImplementation(async (request) => request);
    mocks.consume.mockReset().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    mocks.getResponseTeamWhatsApp.mockReset().mockReturnValue(TEAM_PHONE);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('responde 400 con JSON inválido sin consumir rate limit', async () => {
    const res = await POST(postRequest('{no es json'));

    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'El cuerpo de la solicitud no es un JSON válido' });
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('responde 429 con Retry-After cuando se agota el rate limit', async () => {
    mocks.consume.mockResolvedValue({ allowed: false, retryAfterSeconds: 1800 });

    const res = await POST(postRequest(JSON.stringify(VALID_BODY)));

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('1800');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toMatchObject({ retryAfter: 1800 });
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('usa un bucket por IP del cliente', async () => {
    await POST(postRequest(JSON.stringify(VALID_BODY)));
    expect(mocks.consume).toHaveBeenCalledWith('submit:203.0.113.9', 5, 3600);
  });

  it('responde 422 con details ante datos inválidos', async () => {
    const res = await POST(
      postRequest(JSON.stringify({ ...VALID_BODY, fullName: 'X', categories: [] })),
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: string;
      details: Array<{ field: string; message: string }>;
    };
    expect(body.error).toBe('Datos inválidos');
    expect(body.details.map((d) => d.field).sort()).toEqual(['categories', 'fullName']);
    expect(body.details.every((d) => typeof d.message === 'string' && d.message.length > 0)).toBe(
      true,
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('responde 201 con un enlace de WhatsApp al equipo, sin el teléfono del solicitante', async () => {
    const res = await POST(
      postRequest(
        JSON.stringify({
          ...VALID_BODY,
          status: 'verificado',
          isVerified: 'verificado',
          is_verified: true,
        }),
      ),
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(['createdAt', 'id', 'status', 'whatsAppLink']);
    expect(body.status).toBe('pendiente');
    expect(body.whatsAppLink.startsWith(`https://wa.me/${TEAM_PHONE}?text=`)).toBe(true);
    expect(decodeURIComponent(body.whatsAppLink)).not.toContain(REQUESTER_PHONE);
    expect(JSON.stringify(body)).not.toContain(REQUESTER_PHONE);

    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][0].status).toBe('pendiente');
  });

  it('responde 500 con mensaje genérico si falla el repositorio', async () => {
    mocks.save.mockRejectedValue(new Error('duplicate key value violates "logistics_pkey"'));

    const res = await POST(postRequest(JSON.stringify(VALID_BODY)));

    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain('duplicate key');
    expect(text).not.toContain('logistics_pkey');
    expect(JSON.parse(text)).toEqual({
      error: 'Ocurrió un error interno. Inténtelo de nuevo más tarde.',
    });
  });

  it('responde 500 genérico si falta la configuración del equipo', async () => {
    mocks.getResponseTeamWhatsApp.mockImplementation(() => {
      throw new Error('RESPONSE_TEAM_WHATSAPP es requerido');
    });

    const res = await POST(postRequest(JSON.stringify(VALID_BODY)));

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('RESPONSE_TEAM_WHATSAPP');
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('responde 500 genérico si falla el rate limiter', async () => {
    mocks.consume.mockRejectedValue(new Error('Error al consultar el rate limit: secreto'));

    const res = await POST(postRequest(JSON.stringify(VALID_BODY)));

    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('secreto');
  });
});
