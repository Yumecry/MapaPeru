import type { HotspotProperties } from '../types';

export class Hotspot {
  readonly id: string;
  readonly properties: HotspotProperties;

  private constructor(properties: HotspotProperties) {
    this.id = properties.id;
    this.properties = Object.freeze({ ...properties });
  }

  static create(properties: HotspotProperties): Hotspot {
    return new Hotspot(properties);
  }

  get coordinates(): [number, number] {
    return [this.properties.longitude, this.properties.latitude];
  }

  get frp(): number {
    return this.properties.frp;
  }

  get confidence(): 'n' | 'h' {
    return this.properties.confidence;
  }
}
