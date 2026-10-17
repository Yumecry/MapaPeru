import { PERU_BOUNDS } from '@/application/schemas/logistics-request.schema';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const PERU_CENTER: [number, number] = [-9.19, -75.02];

export const PERU_MAX_BOUNDS: [[number, number], [number, number]] = [
  [PERU_BOUNDS.minLatitude, PERU_BOUNDS.minLongitude],
  [PERU_BOUNDS.maxLatitude, PERU_BOUNDS.maxLongitude],
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function roundCoordinate(value: number): number {
  return Number(value.toFixed(6));
}

export function isInsidePeru({ latitude, longitude }: Coordinates): boolean {
  return (
    latitude >= PERU_BOUNDS.minLatitude &&
    latitude <= PERU_BOUNDS.maxLatitude &&
    longitude >= PERU_BOUNDS.minLongitude &&
    longitude <= PERU_BOUNDS.maxLongitude
  );
}

// Un clic en el mapa puede caer fuera del bbox (el borde de maxBounds no es exacto).
export function toPeruCoordinates({ latitude, longitude }: Coordinates): Coordinates {
  return {
    latitude: roundCoordinate(
      clamp(latitude, PERU_BOUNDS.minLatitude, PERU_BOUNDS.maxLatitude),
    ),
    longitude: roundCoordinate(
      clamp(longitude, PERU_BOUNDS.minLongitude, PERU_BOUNDS.maxLongitude),
    ),
  };
}
