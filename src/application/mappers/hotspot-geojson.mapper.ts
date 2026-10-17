import type { Hotspot } from '@/domain/entities/hotspot.entity';
import type {
  HotspotPointFeature,
  HotspotFeatureCollection,
} from '@/application/dto/hotspot-geojson';

export function hotspotToGeoJSON(hotspots: Hotspot[]): HotspotFeatureCollection {
  const features: HotspotPointFeature[] = hotspots.map((hotspot) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: hotspot.coordinates,
    },
    properties: {
      id: hotspot.id,
      frp: hotspot.frp,
      confidence: hotspot.confidence,
      source: hotspot.properties.source,
      acquisitionDate: hotspot.properties.acquisitionDate,
      satellite: hotspot.properties.satellite,
    },
  }));

  return { type: 'FeatureCollection', features };
}
