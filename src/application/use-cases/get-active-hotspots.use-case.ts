import type { Hotspot } from '@/domain/entities/hotspot.entity';
import type { BBox, IHotspotRepository } from '@/domain/repositories/hotspot.repository';

export const DEFAULT_HOTSPOT_WINDOW_HOURS = 48;

export interface GetActiveHotspotsInput {
  hours?: number;
  bbox?: BBox;
  minFrp?: number;
}

export class GetActiveHotspotsUseCase {
  constructor(
    private readonly hotspotRepository: IHotspotRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(input: GetActiveHotspotsInput = {}): Promise<Hotspot[]> {
    const hours = input.hours ?? DEFAULT_HOTSPOT_WINDOW_HOURS;
    const since = new Date(this.now().getTime() - hours * 3_600_000).toISOString();
    return this.hotspotRepository.findActive({
      since,
      bbox: input.bbox,
      minFrp: input.minFrp,
    });
  }
}
