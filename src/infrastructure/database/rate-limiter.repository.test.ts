import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRateLimiter } from './rate-limiter.repository';

// rate-limiter.repository importa supabase.client (que importa 'server-only', con alias
// a un módulo vacío en vitest.config.ts). El cliente real nunca se instancia aquí.

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const client = { rpc } as unknown as SupabaseClient;
  return { rpc, getClient: () => client };
}

describe('SupabaseRateLimiter', () => {
  it('llama a consume_rate_limit con los parámetros correctos', async () => {
    const { rpc, getClient } = fakeClient({
      data: [{ allowed: true, retry_after: 0 }],
      error: null,
    });

    await new SupabaseRateLimiter(getClient).consume('submit:1.2.3.4', 5, 3600);

    expect(rpc).toHaveBeenCalledWith('consume_rate_limit', {
      p_bucket: 'submit:1.2.3.4',
      p_limit: 5,
      p_window_seconds: 3600,
    });
  });

  it('mapea una fila permitida', async () => {
    const { getClient } = fakeClient({ data: [{ allowed: true, retry_after: 0 }], error: null });
    await expect(new SupabaseRateLimiter(getClient).consume('b', 5, 60)).resolves.toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
  });

  it('mapea una fila bloqueada con retry_after', async () => {
    const { getClient } = fakeClient({ data: [{ allowed: false, retry_after: 1234 }], error: null });
    await expect(new SupabaseRateLimiter(getClient).consume('b', 5, 60)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 1234,
    });
  });

  it('lanza ante un error de Supabase', async () => {
    const { getClient } = fakeClient({ data: null, error: { message: 'boom' } });
    await expect(new SupabaseRateLimiter(getClient).consume('b', 5, 60)).rejects.toThrow(
      /rate limit: boom/,
    );
  });

  it.each([
    ['null', null],
    ['array vacío', []],
    ['dos filas', [
      { allowed: true, retry_after: 0 },
      { allowed: true, retry_after: 0 },
    ]],
    ['objeto suelto', { allowed: true, retry_after: 0 }],
    ['allowed no booleano', [{ allowed: 'true', retry_after: 0 }]],
    ['retry_after negativo', [{ allowed: false, retry_after: -1 }]],
    ['retry_after decimal', [{ allowed: false, retry_after: 1.5 }]],
  ])('lanza ante una forma inválida (%s)', async (_label, data) => {
    const { getClient } = fakeClient({ data, error: null });
    await expect(new SupabaseRateLimiter(getClient).consume('b', 5, 60)).rejects.toThrow(
      'Respuesta inesperada de consume_rate_limit',
    );
  });
});
