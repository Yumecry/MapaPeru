import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Hotspot } from '@/domain/entities/hotspot.entity';
import type { GetActiveHotspotsInput } from '@/application/use-cases/get-active-hotspots.use-case';

const mocks = vi.hoisted(() => ({
  execute: vi.fn<(input: GetActiveHotspotsInput) => Promise<Hotspot[]>>(),
}));

vi.mock('@/infrastructure/database/postgis-hotspot.repository', () => ({
  PostgisHotspotRepository: class {},
}));

vi.mock('@/infrastructure/adapters/nasa-firms.adapter', () => {
  throw new Error('/api/hotspots no debe importar el adaptador de FIRMS');
});

vi.mock('@/application/use-cases/get-active-hotspots.use-case', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/application/use-cases/get-active-hotspots.use-case')>();
  return {
    ...original,
    GetActiveHotspotsUseCase: class {
      execute = mocks.execute;
    },
  };
});

const { GET } = await import('./route');

function getRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/hotspots${query}`);
}

const HOTSPOT = Hotspot.create({
  id: 'NOAA-20-2026-10-15-0612--12.5000--75.1000',
  latitude: -12.5,
  longitude: -75.1,
  frp: 12.5,
  confidence: 'h',
  source: 'VIIRS_NOAA20_NRT',
  acquisitionDate: '2026-10-15T06:12:00.000Z',
  brightness: 330.1,
  scan: 0.4,
  track: 0.37,
  satellite: 'NOAA-20',
});

describe('GET /api/hotspots', () => {
  beforeEach(() => {
    mocks.execute.mockReset();
    mocks.execute.mockResolvedValue([HOTSPOT]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('devuelve un FeatureCollection con caché de 15 min', async () => {
    const res = await GET(getRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('s-maxage=900, stale-while-revalidate');
    expect(await res.json()).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-75.1, -12.5] },
          properties: {
            id: 'NOAA-20-2026-10-15-0612--12.5000--75.1000',
            frp: 12.5,
            confidence: 'h',
            source: 'VIIRS_NOAA20_NRT',
            acquisitionDate: '2026-10-15T06:12:00.000Z',
            satellite: 'NOAA-20',
          },
        },
      ],
    });
  });

  it('usa 48 h por defecto y sin bbox ni min_frp', async () => {
    await GET(getRequest());
    expect(mocks.execute).toHaveBeenCalledWith({ hours: 48, bbox: undefined, minFrp: undefined });
  });

  it('pasa min_frp, hours y bbox validados', async () => {
    await GET(getRequest('?min_frp=12.5&hours=168&bbox=-81.4,-18.5,-68.6,0'));
    expect(mocks.execute).toHaveBeenCalledWith({
      hours: 168,
      bbox: [-81.4, -18.5, -68.6, 0],
      minFrp: 12.5,
    });
  });

  it.each([
    ['min_frp negativo', '?min_frp=-1'],
    ['min_frp no numérico', '?min_frp=abc'],
    ['min_frp infinito', '?min_frp=Infinity'],
    ['hours 0', '?hours=0'],
    ['hours 169', '?hours=169'],
    ['hours decimal', '?hours=1.5'],
    ['hours texto', '?hours=dos'],
    ['bbox con 3 valores', '?bbox=-81,-18,-68'],
    ['bbox con 5 valores', '?bbox=-81,-18,-68,0,1'],
    ['bbox no numérico', '?bbox=a,b,c,d'],
    ['bbox longitud fuera de rango', '?bbox=-181,-18,-68,0'],
    ['bbox latitud fuera de rango', '?bbox=-81,-91,-68,0'],
    ['bbox oeste >= este', '?bbox=-68,-18,-81,0'],
    ['bbox sur >= norte', '?bbox=-81,0,-68,-18'],
  ])('responde 400 (%s)', async (_label, query) => {
    const res = await GET(getRequest(query));

    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toHaveProperty('error');
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it('ante un error del repositorio responde 502 genérico', async () => {
    mocks.execute.mockRejectedValue(new Error('Error al consultar focos de calor: detalle-sql'));

    const res = await GET(getRequest());

    expect(res.status).toBe(502);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toContain('detalle-sql');
    expect(console.error).toHaveBeenCalled();
  });
});
