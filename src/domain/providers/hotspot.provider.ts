import type { Hotspot } from '../entities/hotspot.entity';

export interface IHotspotProvider {
  fetchRecent(): Promise<Hotspot[]>;
}
