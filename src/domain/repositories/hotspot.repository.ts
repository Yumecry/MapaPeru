import type { Hotspot } from '../entities/hotspot.entity';

export interface HotspotQueryFilters {
  minFrp?: number;
  sources?: Array<'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT'>;
  dateFrom?: string;
  dateTo?: string;
}

export interface IHotspotRepository {
  getActive(filters?: HotspotQueryFilters): Promise<Hotspot[]>;
}
