import type { SupplyCategory, UrgencyLevel } from '@/domain/types';

/** Vista pública de una solicitud verificada: sin nombre, teléfono ni descripción. */
export interface PublicLogisticsView {
  id: string;
  region: string;
  district: string;
  urgency: UrgencyLevel;
  categories: SupplyCategory[];
  whatsAppLink: string;
  createdAt: string;
}

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
