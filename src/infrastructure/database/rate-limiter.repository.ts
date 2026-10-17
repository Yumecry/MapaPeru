import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase.client';
import type { IRateLimiter, RateLimitResult } from '@/application/ports/rate-limiter.port';

const RPC_RESULT_SCHEMA = z
  .array(
    z.object({
      allowed: z.boolean(),
      retry_after: z.number().int().nonnegative(),
    }),
  )
  .length(1);

export class SupabaseRateLimiter implements IRateLimiter {
  constructor(private readonly getClient: () => SupabaseClient = getSupabase) {}

  async consume(bucket: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const { data, error } = await this.getClient().rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      throw new Error(`Error al consultar el rate limit: ${error.message}`);
    }

    const parsed = RPC_RESULT_SCHEMA.safeParse(data);
    if (!parsed.success) {
      throw new Error('Respuesta inesperada de consume_rate_limit');
    }

    const [row] = parsed.data;
    return { allowed: row.allowed, retryAfterSeconds: row.retry_after };
  }
}
