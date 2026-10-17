export type HotspotSource = 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT';

export type HotspotPointProperties = {
  id: string;
  frp: number;
  confidence: 'n' | 'h';
  source: HotspotSource;
  acquisitionDate: string;
  satellite: 'NOAA-20' | 'NOAA-21';
};

export interface HotspotPointFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: HotspotPointProperties;
}

export interface HotspotFeatureCollection {
  type: 'FeatureCollection';
  features: HotspotPointFeature[];
}
