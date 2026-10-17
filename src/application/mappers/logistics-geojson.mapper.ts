import type { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import {
  toPublicLogisticsView,
  type PublicLogisticsView,
} from '@/application/mappers/public-logistics-view.mapper';

export interface PublicLogisticsFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: PublicLogisticsView;
}

export interface PublicLogisticsFeatureCollection {
  type: 'FeatureCollection';
  features: PublicLogisticsFeature[];
}

export function logisticsToGeoJSON(
  requests: LogisticsRequest[],
  teamPhone: string,
): PublicLogisticsFeatureCollection {
  const features: PublicLogisticsFeature[] = requests.map((request) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [request.longitude, request.latitude],
    },
    properties: toPublicLogisticsView(request, teamPhone),
  }));

  return { type: 'FeatureCollection', features };
}
