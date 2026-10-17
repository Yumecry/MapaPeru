import type { IHotspotProvider } from '@/domain/providers/hotspot.provider';
import type { IHotspotRepository } from '@/domain/repositories/hotspot.repository';

export interface SyncHotspotsResult {
  fetched: number;
  upserted: number;
}

export class SyncHotspotsUseCase {
  constructor(
    private readonly provider: IHotspotProvider,
    private readonly repository: IHotspotRepository,
  ) {}

  async execute(): Promise<SyncHotspotsResult> {
    const hotspots = await this.provider.fetchRecent();
    const upserted = hotspots.length > 0 ? await this.repository.upsert(hotspots) : 0;
    return { fetched: hotspots.length, upserted };
  }
}
