import { getSupabase } from './supabase.client';
import { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import {
  StatusConflictError,
  type ILogisticsRepository,
  type VerifiedRequestFilters,
} from '@/domain/repositories/logistics.repository';
import { z } from 'zod';

const TABLE = 'logistics_requests';

const COLUMNS =
  'id, full_name, phone, region, district, latitude, longitude, categories, urgency, description, status, verified_by, verified_at, rejection_reason, created_at, updated_at';

const PENDING_LIMIT = 200;

const DB_ROW_SCHEMA = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  phone: z.string(),
  region: z.string(),
  district: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  categories: z.array(z.enum(['agua', 'colirios', 'herramientas', 'veterinaria'])),
  urgency: z.enum(['critico', 'moderado', 'cubierto']),
  description: z.string(),
  status: z.enum(['pendiente', 'verificado', 'rechazado']),
  verified_by: z.string().uuid().nullable(),
  verified_at: z.string().nullable(),
  rejection_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

type DbRow = z.infer<typeof DB_ROW_SCHEMA>;

function rowToEntity(row: DbRow): LogisticsRequest {
  return LogisticsRequest.fromPrimitives({
    id: row.id,
    contact: {
      fullName: row.full_name,
      phone: row.phone,
      region: row.region,
      district: row.district,
    },
    latitude: row.latitude,
    longitude: row.longitude,
    categories: row.categories,
    urgency: row.urgency,
    description: row.description,
    status: row.status,
    verifiedBy: row.verified_by ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function rowsToEntities(data: unknown[] | null): LogisticsRequest[] {
  if (!data) return [];
  return data
    .map((row: unknown) => DB_ROW_SCHEMA.safeParse(row))
    .filter((parsed): parsed is z.ZodSafeParseSuccess<DbRow> => parsed.success)
    .map((parsed) => rowToEntity(parsed.data));
}

function parseRow(row: unknown): LogisticsRequest {
  const parsed = DB_ROW_SCHEMA.safeParse(row);
  if (!parsed.success) {
    throw new Error('Fila de solicitud con formato inesperado');
  }
  return rowToEntity(parsed.data);
}

export class PostgisLogisticsRepository implements ILogisticsRepository {
  async save(request: LogisticsRequest): Promise<LogisticsRequest> {
    const { error } = await getSupabase().from(TABLE).insert({
      id: request.id,
      full_name: request.contact.fullName,
      phone: request.contact.phone,
      region: request.contact.region,
      district: request.contact.district,
      latitude: request.latitude,
      longitude: request.longitude,
      categories: request.categories,
      urgency: request.urgency,
      description: request.description,
      status: 'pendiente',
    });

    if (error) {
      throw new Error(`Error al guardar solicitud: ${error.message}`);
    }

    return request;
  }

  async getVerified(filters?: VerifiedRequestFilters): Promise<LogisticsRequest[]> {
    let query = getSupabase().from(TABLE).select(COLUMNS).eq('status', 'verificado');

    if (filters?.region) {
      query = query.ilike('region', `%${filters.region}%`);
    }

    if (filters?.urgency) {
      query = query.eq('urgency', filters.urgency);
    }

    if (filters?.categories && filters.categories.length > 0) {
      query = query.contains('categories', filters.categories);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener solicitudes: ${error.message}`);
    }

    return rowsToEntities(data);
  }

  async findPending(): Promise<LogisticsRequest[]> {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select(COLUMNS)
      .eq('status', 'pendiente')
      .order('created_at', { ascending: true })
      .limit(PENDING_LIMIT);

    if (error) {
      throw new Error(`Error al obtener solicitudes pendientes: ${error.message}`);
    }

    return rowsToEntities(data);
  }

  async findById(id: string): Promise<LogisticsRequest | null> {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select(COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al obtener la solicitud: ${error.message}`);
    }

    return data ? parseRow(data) : null;
  }

  async saveDecision(request: LogisticsRequest): Promise<LogisticsRequest> {
    if (request.status === 'pendiente') {
      throw new Error('saveDecision requiere una solicitud verificada o rechazada');
    }

    const { data, error } = await getSupabase()
      .from(TABLE)
      .update({
        status: request.status,
        verified_by: request.verifiedBy ?? null,
        verified_at: request.verifiedAt ?? null,
        rejection_reason: request.rejectionReason ?? null,
      })
      .eq('id', request.id)
      .eq('status', 'pendiente')
      .select(COLUMNS);

    if (error) {
      throw new Error(`Error al guardar la decisión: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new StatusConflictError(request.id);
    }

    return parseRow(data[0]);
  }
}
