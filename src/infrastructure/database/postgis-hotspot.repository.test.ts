import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Hotspot } from '@/domain/entities/hotspot.entity';
import type { HotspotProperties } from '@/domain/types';
import {
  PostgisHotspotRepository,
  UPSERT_BATCH_SIZE,
  toEwktPoint,
  type HotspotInsertRow,
} from './postgis-hotspot.repository';

function hotspot(overrides: Partial<HotspotProperties> = {}): Hotspot {
  return Hotspot.create({
    id: 'NOAA-20-2026-10-15-0612--12.5000--75.1000',
    latitude: -12.5,
    longitude: -75.1,
    frp: 12.5,
    confidence: 'n',
    source: 'VIIRS_NOAA20_NRT',
    acquisitionDate: '2026-10-15T06:12:00Z',
    brightness: 330.1,
    scan: 0.4,
    track: 0.37,
    satellite: 'NOAA-20',
    ...overrides,
  });
}

function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    firms_id: 'NOAA-21-2026-10-15-1800--13.3000--72.1000',
    longitude: -72.1,
    latitude: -13.3,
    frp: 40,
    confidence: 'h',
    source: 'VIIRS_NOAA21_NRT',
    satellite: 'NOAA-21',
    acquisition_date: '2026-10-15T18:00:00+00:00',
    brightness: 340,
    scan: 0.5,
    track: 0.4,
    ...overrides,
  };
}

function fakeClient(options: {
  upsertError?: { message: string } | null;
  rpcResult?: { data: unknown; error: { message: string } | null };
} = {}) {
  const upsert = vi
    .fn<(rows: HotspotInsertRow[], opts: { onConflict: string }) => Promise<{ error: unknown }>>()
    .mockResolvedValue({ error: options.upsertError ?? null });
  const from = vi.fn(() => ({ upsert }));
  const rpc = vi.fn().mockResolvedValue(options.rpcResult ?? { data: [], error: null });
  const client = { from, rpc } as unknown as SupabaseClient;
  return { from, upsert, rpc, getClient: () => client };
}

describe('toEwktPoint', () => {
  it('genera EWKT con SRID 4326 y orden lng lat', () => {
    expect(toEwktPoint(-75.1, -12.5)).toBe('SRID=4326;POINT(-75.1 -12.5)');
  });

  it('rechaza coordenadas no finitas', () => {
    expect(() => toEwktPoint(Number.NaN, 0)).toThrow();
  });
});

describe('PostgisHotspotRepository.upsert', () => {
  it('hace upsert en hotspots con onConflict firms_id y filas mapeadas', async () => {
    const { from, upsert, getClient } = fakeClient();

    const count = await new PostgisHotspotRepository(getClient).upsert([hotspot()]);

    expect(count).toBe(1);
    expect(from).toHaveBeenCalledWith('hotspots');
    expect(upsert).toHaveBeenCalledWith(
      [
        {
          firms_id: 'NOAA-20-2026-10-15-0612--12.5000--75.1000',
          geom: 'SRID=4326;POINT(-75.1 -12.5)',
          frp: 12.5,
          confidence: 'n',
          source: 'VIIRS_NOAA20_NRT',
          satellite: 'NOAA-20',
          acquisition_date: '2026-10-15T06:12:00Z',
          brightness: 330.1,
          scan: 0.4,
          track: 0.37,
        },
      ],
      { onConflict: 'firms_id' },
    );
  });

  it('divide en lotes de UPSERT_BATCH_SIZE', async () => {
    const { upsert, getClient } = fakeClient();
    const total = UPSERT_BATCH_SIZE * 2 + 3;
    const hotspots = Array.from({ length: total }, (_, i) => hotspot({ id: `id-${i}` }));

    const count = await new PostgisHotspotRepository(getClient).upsert(hotspots);

    expect(count).toBe(total);
    expect(upsert.mock.calls.map(([rows]) => rows.length)).toEqual([
      UPSERT_BATCH_SIZE,
      UPSERT_BATCH_SIZE,
      3,
    ]);
  });

  it('deduplica por firms_id antes de enviar', async () => {
    const { upsert, getClient } = fakeClient();

    const count = await new PostgisHotspotRepository(getClient).upsert([
      hotspot({ frp: 1 }),
      hotspot({ frp: 2 }),
    ]);

    expect(count).toBe(1);
    expect(upsert.mock.calls[0][0]).toHaveLength(1);
    expect(upsert.mock.calls[0][0][0].frp).toBe(2);
  });

  it('no llama a Supabase con una lista vacía', async () => {
    const { upsert, getClient } = fakeClient();
    await expect(new PostgisHotspotRepository(getClient).upsert([])).resolves.toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('lanza ante un error de Supabase', async () => {
    const { getClient } = fakeClient({ upsertError: { message: 'boom' } });
    await expect(new PostgisHotspotRepository(getClient).upsert([hotspot()])).rejects.toThrow(
      /guardar focos de calor: boom/,
    );
  });
});

describe('PostgisHotspotRepository.findActive', () => {
  it('llama a hotspots_in_bbox solo con since si no hay más filtros', async () => {
    const { rpc, getClient } = fakeClient();

    await new PostgisHotspotRepository(getClient).findActive({ since: '2026-10-14T00:00:00.000Z' });

    expect(rpc).toHaveBeenCalledWith('hotspots_in_bbox', { p_since: '2026-10-14T00:00:00.000Z' });
  });

  it('pasa bbox y min_frp como parámetros p_*', async () => {
    const { rpc, getClient } = fakeClient();

    await new PostgisHotspotRepository(getClient).findActive({
      since: '2026-10-14T00:00:00.000Z',
      bbox: [-81.4, -18.5, -68.6, 0],
      minFrp: 10,
    });

    expect(rpc).toHaveBeenCalledWith('hotspots_in_bbox', {
      p_since: '2026-10-14T00:00:00.000Z',
      p_west: -81.4,
      p_south: -18.5,
      p_east: -68.6,
      p_north: 0,
      p_min_frp: 10,
    });
  });

  it('mapea las filas planas a entidades Hotspot', async () => {
    const { getClient } = fakeClient({ rpcResult: { data: [rpcRow()], error: null } });

    const [result] = await new PostgisHotspotRepository(getClient).findActive({
      since: '2026-10-14T00:00:00.000Z',
    });

    expect(result.id).toBe('NOAA-21-2026-10-15-1800--13.3000--72.1000');
    expect(result.coordinates).toEqual([-72.1, -13.3]);
    expect(result.properties).toMatchObject({
      frp: 40,
      confidence: 'h',
      source: 'VIIRS_NOAA21_NRT',
      satellite: 'NOAA-21',
      acquisitionDate: '2026-10-15T18:00:00.000Z',
      brightness: 340,
      scan: 0.5,
      track: 0.4,
    });
  });

  it('lanza ante un error de Supabase', async () => {
    const { getClient } = fakeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
    await expect(
      new PostgisHotspotRepository(getClient).findActive({ since: '2026-10-14T00:00:00Z' }),
    ).rejects.toThrow(/consultar focos de calor: boom/);
  });

  it.each([
    ['null', null],
    ['objeto suelto', rpcRow()],
    ['confidence l', [rpcRow({ confidence: 'l' })]],
    ['longitud fuera de rango', [rpcRow({ longitude: 200 })]],
    ['fecha inválida', [rpcRow({ acquisition_date: 'ayer' })]],
    ['frp como texto', [rpcRow({ frp: '40' })]],
  ])('lanza ante una forma inválida (%s)', async (_label, data) => {
    const { getClient } = fakeClient({ rpcResult: { data, error: null } });
    await expect(
      new PostgisHotspotRepository(getClient).findActive({ since: '2026-10-14T00:00:00Z' }),
    ).rejects.toThrow('Respuesta inesperada de hotspots_in_bbox');
  });
});
