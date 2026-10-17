import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  execute: vi.fn<() => Promise<{ fetched: number; upserted: number }>>(),
  adapterConfig: vi.fn<(config: unknown) => void>(),
}));

vi.mock('@/infrastructure/adapters/nasa-firms.adapter', () => ({
  NasaFirmsAdapter: class {
    constructor(config: unknown) {
      mocks.adapterConfig(config);
    }
  },
}));

vi.mock('@/infrastructure/database/postgis-hotspot.repository', () => ({
  PostgisHotspotRepository: class {},
}));

vi.mock('@/application/use-cases/sync-hotspots.use-case', () => ({
  SyncHotspotsUseCase: class {
    execute = mocks.execute;
  },
}));

const { GET, maxDuration } = await import('./route');

const SECRET = 's3cr3t-valor-largo';

function getRequest(authorization?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return new NextRequest('http://localhost/api/cron/firms-sync', { headers });
}

describe('GET /api/cron/firms-sync', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', SECRET);
    mocks.execute.mockReset();
    mocks.adapterConfig.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('declara maxDuration = 60', () => {
    expect(maxDuration).toBe(60);
  });

  it('sin CRON_SECRET configurado responde 500 genérico y no sincroniza', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await GET(getRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/CRON_SECRET/);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    ['sin cabecera', undefined],
    ['secreto erróneo', 'Bearer otro'],
    ['sin prefijo Bearer', SECRET],
    ['prefijo en minúsculas', `bearer ${SECRET}`],
    ['secreto con sufijo', `Bearer ${SECRET}x`],
  ])('responde 401 (%s)', async (_label, authorization) => {
    const res = await GET(getRequest(authorization));

    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('con Bearer válido sincroniza y devuelve los conteos sin caché', async () => {
    mocks.execute.mockResolvedValue({ fetched: 12, upserted: 10 });

    const res = await GET(getRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ fetched: 12, upserted: 10 });
    expect(mocks.adapterConfig).toHaveBeenCalledWith({ dayRange: 2 });
  });

  it('ante un error interno responde con mensaje genérico y registra el detalle', async () => {
    mocks.execute.mockRejectedValue(new Error('NASA FIRMS API error: 500 detalle-interno'));

    const res = await GET(getRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Ocurrió un error interno. Inténtelo de nuevo más tarde.');
    expect(JSON.stringify(body)).not.toContain('detalle-interno');
    expect(console.error).toHaveBeenCalled();
  });
});
