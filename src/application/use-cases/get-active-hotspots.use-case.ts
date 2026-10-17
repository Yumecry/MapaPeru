import type { Hotspot } from '@/domain/entities/hotspot.entity';
import type {
  HotspotQueryFilters,
  IHotspotRepository,
} from '@/domain/repositories/hotspot.repository';

export class GetActiveHotspotsUseCase {
  constructor(private readonly hotspotRepository: IHotspotRepository) {}

  async execute(filters?: HotspotQueryFilters): Promise<Hotspot[]> {
    return this.hotspotRepository.getActive(filters);
  }
}
