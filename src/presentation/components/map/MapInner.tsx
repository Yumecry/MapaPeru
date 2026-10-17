'use client';

import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { HotspotLayer } from './HotspotLayer';
import { LogisticsMarkerLayer } from './LogisticsMarkerLayer';
import { useMapData } from '@/presentation/hooks/useMapData';
import type { MapFilters } from '@/presentation/hooks/useMapFilters';

const PERU_CENTER: [number, number] = [-9.19, -75.02];

interface MapInnerProps {
  filters: MapFilters;
}

export function MapInner({ filters }: MapInnerProps) {
  const {
    hotspots,
    logistics,
    loading,
    hotspotsLoading,
    logisticsLoading,
    hotspotsError,
    logisticsError,
  } = useMapData(filters);
  const errors = [hotspotsError, logisticsError].filter(
    (e): e is string => e !== null,
  );
  const showCounters = !hotspotsLoading && !logisticsLoading && errors.length < 2;

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={PERU_CENTER}
        zoom={6}
        minZoom={5}
        maxZoom={16}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HotspotLayer hotspots={hotspots.features} />
        <LogisticsMarkerLayer requests={logistics.features} />
      </MapContainer>

      {loading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[500] rounded-full bg-slate-900/90 px-3 py-1 text-xs text-amber-400">
          Actualizando datos…
        </div>
      )}

      {showCounters && (
        <div className="absolute bottom-4 right-4 z-[500] rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white space-y-1">
          {!hotspotsError && (
            <p className="font-semibold">{hotspots.features.length} focos de calor</p>
          )}
          {!logisticsError && (
            <p>{logistics.features.length} solicitudes verificadas</p>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div
          role="alert"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] rounded-lg bg-red-900/90 px-4 py-2 text-xs text-white space-y-1"
        >
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
    </div>
  );
}