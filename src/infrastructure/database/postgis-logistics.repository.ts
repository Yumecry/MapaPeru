import { getSupabase } from './supabase.client';
import { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import type {
  ILogisticsRepository,
  VerifiedRequestFilters,
} from '@/domain/repositories/logistics.repository';
import type {
  SupplyCategory,
  UrgencyLevel,
  VerifyStatus,
} from '@/domain/types';
import { z } from 'zod';

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
  is_verified: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

type DbRow = z.infer<typeof DB_ROW_SCHEMA>;

function rowToEntity(row: DbRow): LogisticsRequest {
  const verifyStatus: VerifyStatus = row.is_verified ? 'verificado' : 'pendiente';

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
    categories: row.categories as SupplyCategory[],
    urgency: row.urgency as UrgencyLevel,
    description: row.description,
    isVerified: verifyStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class PostgisLogisticsRepository implements ILogisticsRepository {
  async save(request: LogisticsRequest): Promise<LogisticsRequest> {
    const { error } = await getSupabase().from('logistics_requests').insert({
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
      is_verified: false,
    });

    if (error) {
      throw new Error(`Error al guardar solicitud: ${error.message}`);
    }

    return request;
  }

  async getVerified(filters?: VerifiedRequestFilters): Promise<LogisticsRequest[]> {
    let query = getSupabase()
      .from('logistics_requests')
      .select('*')
      .eq('is_verified', true);

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

    if (!data) return [];

    return data
      .map((row: unknown) => DB_ROW_SCHEMA.safeParse(row))
      .filter((parsed): parsed is z.ZodSafeParseSuccess<DbRow> => parsed.success)
      .map((parsed) => rowToEntity(parsed.data));
  }
}
