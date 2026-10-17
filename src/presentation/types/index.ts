import type { ReactNode } from 'react';

export interface IMapLayer {
  id: string;
  label: string;
  render(): ReactNode;
}

export type HotspotSource = 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT';

export type HotspotPointProperties = {
  id: string;
  frp: number;
  confidence: 'n' | 'h';
  source: HotspotSource;
  acquisitionDate: string;
  satellite: 'NOAA-20' | 'NOAA-21';
};

export type ClusterAggregate = Record<string, never>;

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoFeature<P> {
  type: 'Feature';
  geometry: GeoPoint;
  properties: P;
}

export interface GeoFeatureCollection<P> {
  type: 'FeatureCollection';
  features: GeoFeature<P>[];
}

export type HotspotPointFeature = GeoFeature<HotspotPointProperties>;

export type HotspotFeatureCollection = GeoFeatureCollection<HotspotPointProperties>;

export type LogisticsProperties = {
  id: string;
  createdAt: string;
  region: string;
  district: string;
  urgency: 'critico' | 'moderado' | 'cubierto';
  categories: string[];
  whatsAppLink: string;
};

export type LogisticsFeature = GeoFeature<LogisticsProperties>;

export type LogisticsFeatureCollection = GeoFeatureCollection<LogisticsProperties>;