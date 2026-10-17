import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

export type CronAuthResult = 'ok' | 'unauthorized' | 'misconfigured';

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Compara `Authorization: Bearer <CRON_SECRET>` en tiempo constante.
 * Se comparan los SHA-256 para que ambos buffers tengan siempre la misma longitud.
 */
export function checkCronAuth(
  authorization: string | null,
  secret: string | undefined = process.env.CRON_SECRET,
): CronAuthResult {
  if (!secret) return 'misconfigured';
  if (!authorization) return 'unauthorized';
  const expected = digest(`Bearer ${secret}`);
  const received = digest(authorization);
  return timingSafeEqual(expected, received) ? 'ok' : 'unauthorized';
}
