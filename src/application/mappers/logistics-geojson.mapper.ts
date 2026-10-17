import type { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import type {
  PublicLogisticsFeature,
  PublicLogisticsFeatureCollection,
} from '@/application/dto/logistics-geojson';
import { toPublicLogisticsView } from '@/application/mappers/public-logistics-view.mapper';

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
