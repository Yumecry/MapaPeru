import type { ReactNode } from 'react';

export interface IMapLayer {
  id: string;
  label: string;
  render(): ReactNode;
}

export type {
  HotspotSource,
  HotspotPointProperties,
  HotspotPointFeature,
  HotspotFeatureCollection,
} from '@/application/dto/hotspot-geojson';

export type ClusterAggregate = Record<string, never>;

export type {
  PublicLogisticsView,
  PublicLogisticsFeature,
  PublicLogisticsFeatureCollection,
  PublicLogisticsView as LogisticsProperties,
  PublicLogisticsFeature as LogisticsFeature,
  PublicLogisticsFeatureCollection as LogisticsFeatureCollection,
} from '@/application/dto/logistics-geojson';
