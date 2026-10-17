'use client';

import { CircleMarker, Popup } from 'react-leaflet';
import type { LogisticsFeature } from '@/presentation/types';

const URGENCY_COLORS: Record<string, string> = {
  critico: '#dc2626',
  moderado: '#d97706',
  cubierto: '#65a30d',
};

const URGENCY_LABELS: Record<string, string> = {
  critico: 'Crítico',
  moderado: 'Moderado',
  cubierto: 'Cubierto',
};

interface LogisticsMarkerLayerProps {
  requests: LogisticsFeature[];
}

export function LogisticsMarkerLayer({ requests }: LogisticsMarkerLayerProps) {
  return (
    <>
      {requests.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const color = URGENCY_COLORS[feature.properties.urgency] ?? '#64748b';
        return (
          <CircleMarker
            key={feature.properties.id}
            center={[lat, lng]}
            radius={9}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.85,
              weight: 3,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm">Solicitud verificada</p>
                <p>
                  {feature.properties.region} — {feature.properties.district}
                </p>
                <p>
                  <span className="font-semibold">Urgencia:</span>{' '}
                  {URGENCY_LABELS[feature.properties.urgency]}
                </p>
                <p>
                  <span className="font-semibold">Insumos:</span>{' '}
                  {feature.properties.categories.join(', ')}
                </p>
                <a
                  href={feature.properties.whatsAppLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 px-2 py-1 bg-emerald-600 text-white font-semibold rounded"
                >
                  Contactar por WhatsApp
                </a>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}