import type { BBox } from '@/domain/repositories/hotspot.repository';
import {
  DEFAULT_HOTSPOT_WINDOW_HOURS,
  type GetActiveHotspotsInput,
} from '@/application/use-cases/get-active-hotspots.use-case';

export const MIN_HOURS = 1;
export const MAX_HOURS = 168;

export type HotspotParamsResult =
  | { ok: true; input: GetActiveHotspotsInput & { hours: number } }
  | { ok: false; error: string };

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

function parseBbox(raw: string): BBox | null {
  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 4 || !parts.every((p) => NUMBER_PATTERN.test(p))) return null;
  const [west, south, east, north] = parts.map(Number);
  const lonOk = (v: number) => v >= -180 && v <= 180;
  const latOk = (v: number) => v >= -90 && v <= 90;
  if (!lonOk(west) || !lonOk(east) || !latOk(south) || !latOk(north)) return null;
  if (west >= east || south >= north) return null;
  return [west, south, east, north];
}

export function parseHotspotParams(searchParams: URLSearchParams): HotspotParamsResult {
  const minFrpParam = searchParams.get('min_frp');
  const hoursParam = searchParams.get('hours');
  const bboxParam = searchParams.get('bbox');

  let minFrp: number | undefined;
  if (minFrpParam !== null && minFrpParam !== '') {
    const value = Number(minFrpParam);
    if (!NUMBER_PATTERN.test(minFrpParam) || !Number.isFinite(value) || value < 0) {
      return { ok: false, error: 'min_frp debe ser un número no negativo' };
    }
    minFrp = value;
  }

  let hours = DEFAULT_HOTSPOT_WINDOW_HOURS;
  if (hoursParam !== null && hoursParam !== '') {
    const value = Number(hoursParam);
    if (!/^\d+$/.test(hoursParam) || value < MIN_HOURS || value > MAX_HOURS) {
      return {
        ok: false,
        error: `hours debe ser un entero entre ${MIN_HOURS} y ${MAX_HOURS}`,
      };
    }
    hours = value;
  }

  let bbox: BBox | undefined;
  if (bboxParam !== null && bboxParam !== '') {
    const parsed = parseBbox(bboxParam);
    if (!parsed) {
      return {
        ok: false,
        error: 'bbox debe tener el formato oeste,sur,este,norte con coordenadas válidas',
      };
    }
    bbox = parsed;
  }

  return { ok: true, input: { hours, bbox, minFrp } };
}
