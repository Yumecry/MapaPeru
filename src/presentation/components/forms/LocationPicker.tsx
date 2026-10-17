'use client';

import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  PERU_CENTER,
  PERU_MAX_BOUNDS,
  toPeruCoordinates,
  type Coordinates,
} from './location';

interface LocationPickerProps {
  value: Coordinates | null;
  onChange: (coordinates: Coordinates) => void;
}

function ClickHandler({ onChange }: Pick<LocationPickerProps, 'onChange'>) {
  useMapEvents({
    click: (event) => {
      onChange(
        toPeruCoordinates({ latitude: event.latlng.lat, longitude: event.latlng.lng }),
      );
    },
  });
  return null;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const center: [number, number] = value ? [value.latitude, value.longitude] : PERU_CENTER;

  return (
    <div>
      <p id="location-picker-help" className="mb-1 text-xs text-slate-600">
        Toque el mapa para marcar su ubicación
      </p>
      <div
        role="group"
        aria-describedby="location-picker-help"
        aria-label="Mapa para marcar la ubicación"
        className="h-[220px] w-full overflow-hidden rounded border border-slate-300"
      >
        <MapContainer
          center={center}
          zoom={value ? 13 : 5}
          minZoom={5}
          maxZoom={17}
          maxBounds={PERU_MAX_BOUNDS}
          maxBoundsViscosity={1}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onChange={onChange} />
          {value && (
            <CircleMarker
              center={[value.latitude, value.longitude]}
              radius={9}
              pathOptions={{ color: '#0f172a', fillColor: '#f59e0b', fillOpacity: 0.9, weight: 2 }}
            />
          )}
        </MapContainer>
      </div>
      {value && (
        <p className="mt-1 font-mono text-[11px] text-slate-500">
          {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
        </p>
      )}
    </div>
  );
}
