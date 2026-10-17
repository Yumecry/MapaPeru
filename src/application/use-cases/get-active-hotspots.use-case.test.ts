import { describe, expect, it, vi } from 'vitest';
import type { IHotspotRepository } from '@/domain/repositories/hotspot.repository';
import { GetActiveHotspotsUseCase } from './get-active-hotspots.use-case';

const NOW = new Date('2026-10-16T12:00:00.000Z');

function setup() {
  const findActive = vi.fn<IHotspotRepository['findActive']>().mockResolvedValue([]);
  const upsert = vi.fn<IHotspotRepository['upsert']>();
  const useCase = new GetActiveHotspotsUseCase({ findActive, upsert }, () => NOW);
  return { useCase, findActive };
}

describe('GetActiveHotspotsUseCase', () => {
  it('usa una ventana de 48 h por defecto', async () => {
    const { useCase, findActive } = setup();
    await useCase.execute();
    expect(findActive).toHaveBeenCalledWith({
      since: '2026-10-14T12:00:00.000Z',
      bbox: undefined,
      minFrp: undefined,
    });
  });

  it('calcula since a partir de hours y pasa bbox y minFrp', async () => {
    const { useCase, findActive } = setup();
    await useCase.execute({ hours: 6, bbox: [-80, -18, -68, 0], minFrp: 5 });
    expect(findActive).toHaveBeenCalledWith({
      since: '2026-10-16T06:00:00.000Z',
      bbox: [-80, -18, -68, 0],
      minFrp: 5,
    });
  });
});
