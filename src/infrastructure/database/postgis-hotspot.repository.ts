import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase.client';
import { Hotspot } from '@/domain/entities/hotspot.entity';
import type {
  ActiveHotspotFilters,
  IHotspotRepository,
} from '@/domain/repositories/hotspot.repository';

const TABLE = 'hotspots';
export const UPSERT_BATCH_SIZE = 500;

const RPC_ROW_SCHEMA = z.object({
  firms_id: z.string().min(1),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  frp: z.number().nonnegative(),
  confidence: z.enum(['n', 'h']),
  source: z.enum(['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT']),
  satellite: z.enum(['NOAA-20', 'NOAA-21']),
  acquisition_date: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
  brightness: z.number(),
  scan: z.number(),
  track: z.number(),
});

const RPC_RESULT_SCHEMA = z.array(RPC_ROW_SCHEMA);

type RpcRow = z.infer<typeof RPC_ROW_SCHEMA>;

export interface HotspotInsertRow {
  firms_id: string;
  geom: string;
  frp: number;
  confidence: 'n' | 'h';
  source: string;
  satellite: string;
  acquisition_date: string;
  brightness: number;
  scan: number;
  track: number;
}

export function toEwktPoint(longitude: number, latitude: number): string {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error('Coordenadas inválidas para EWKT');
  }
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}

function toInsertRow(hotspot: Hotspot): HotspotInsertRow {
  const p = hotspot.properties;
  return {
    firms_id: p.id,
    geom: toEwktPoint(p.longitude, p.latitude),
    frp: p.frp,
    confidence: p.confidence,
    source: p.source,
    satellite: p.satellite,
    acquisition_date: p.acquisitionDate,
    brightness: p.brightness,
    scan: p.scan,
    track: p.track,
  };
}

function fromRpcRow(row: RpcRow): Hotspot {
  return Hotspot.create({
    id: row.firms_id,
    latitude: row.latitude,
    longitude: row.longitude,
    frp: row.frp,
    confidence: row.confidence,
    source: row.source,
    acquisitionDate: new Date(row.acquisition_date).toISOString(),
    brightness: row.brightness,
    scan: row.scan,
    track: row.track,
    satellite: row.satellite,
  });
}

export class PostgisHotspotRepository implements IHotspotRepository {
  constructor(private readonly getClient: () => SupabaseClient = getSupabase) {}

  async upsert(hotspots: Hotspot[]): Promise<number> {
    // Un mismo lote no puede contener dos filas con el mismo firms_id
    // (ON CONFLICT DO UPDATE no puede afectar dos veces a la misma fila).
    const unique = new Map<string, HotspotInsertRow>();
    for (const hotspot of hotspots) {
      unique.set(hotspot.id, toInsertRow(hotspot));
    }
    const rows = [...unique.values()];

    for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
      const { error } = await this.getClient()
        .from(TABLE)
        .upsert(batch, { onConflict: 'firms_id' });

      if (error) {
        throw new Error(`Error al guardar focos de calor: ${error.message}`);
      }
    }

    return rows.length;
  }

  async findActive(filters: ActiveHotspotFilters): Promise<Hotspot[]> {
    const params: Record<string, string | number> = { p_since: filters.since };
    if (filters.bbox) {
      const [west, south, east, north] = filters.bbox;
      params.p_west = west;
      params.p_south = south;
      params.p_east = east;
      params.p_north = north;
    }
    if (filters.minFrp !== undefined) {
      params.p_min_frp = filters.minFrp;
    }

    const { data, error } = await this.getClient().rpc('hotspots_in_bbox', params);

    if (error) {
      throw new Error(`Error al consultar focos de calor: ${error.message}`);
    }

    const parsed = RPC_RESULT_SCHEMA.safeParse(data);
    if (!parsed.success) {
      throw new Error('Respuesta inesperada de hotspots_in_bbox');
    }

    return parsed.data.map(fromRpcRow);
  }
}
