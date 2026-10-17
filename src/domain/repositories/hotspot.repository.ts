import type { Hotspot } from '../entities/hotspot.entity';

/** [oeste, sur, este, norte] en grados WGS84. */
export type BBox = [west: number, south: number, east: number, north: number];

export interface ActiveHotspotFilters {
  /** Instante ISO 8601: solo focos adquiridos desde entonces. */
  since: string;
  bbox?: BBox;
  minFrp?: number;
}

export interface IHotspotRepository {
  upsert(hotspots: Hotspot[]): Promise<number>;
  findActive(filters: ActiveHotspotFilters): Promise<Hotspot[]>;
}
