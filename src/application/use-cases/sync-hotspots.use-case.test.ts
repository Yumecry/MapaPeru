import { describe, expect, it, vi } from 'vitest';
import { Hotspot } from '@/domain/entities/hotspot.entity';
import type { IHotspotProvider } from '@/domain/providers/hotspot.provider';
import type { IHotspotRepository } from '@/domain/repositories/hotspot.repository';
import { SyncHotspotsUseCase } from './sync-hotspots.use-case';

function hotspot(id: string): Hotspot {
  return Hotspot.create({
    id,
    latitude: -12.5,
    longitude: -75.1,
    frp: 10,
    confidence: 'n',
    source: 'VIIRS_NOAA20_NRT',
    acquisitionDate: '2026-10-15T06:12:00Z',
    brightness: 330,
    scan: 0.4,
    track: 0.37,
    satellite: 'NOAA-20',
  });
}

function setup(fetched: Hotspot[] | Error, upserted = fetched instanceof Error ? 0 : fetched.length) {
  const fetchRecent = vi.fn<IHotspotProvider['fetchRecent']>();
  if (fetched instanceof Error) fetchRecent.mockRejectedValue(fetched);
  else fetchRecent.mockResolvedValue(fetched);
  const upsert = vi.fn<IHotspotRepository['upsert']>().mockResolvedValue(upserted);
  const findActive = vi.fn<IHotspotRepository['findActive']>();
  const useCase = new SyncHotspotsUseCase({ fetchRecent }, { upsert, findActive });
  return { useCase, fetchRecent, upsert };
}

describe('SyncHotspotsUseCase', () => {
  it('descarga, persiste y devuelve los conteos', async () => {
    const hotspots = [hotspot('a'), hotspot('b'), hotspot('c')];
    const { useCase, upsert } = setup(hotspots, 2);

    await expect(useCase.execute()).resolves.toEqual({ fetched: 3, upserted: 2 });
    expect(upsert).toHaveBeenCalledWith(hotspots);
  });

  it('no escribe si el proveedor no devuelve focos', async () => {
    const { useCase, upsert } = setup([]);

    await expect(useCase.execute()).resolves.toEqual({ fetched: 0, upserted: 0 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('propaga el error del proveedor sin escribir', async () => {
    const { useCase, upsert } = setup(new Error('FIRMS caído'));

    await expect(useCase.execute()).rejects.toThrow('FIRMS caído');
    expect(upsert).not.toHaveBeenCalled();
  });
});
