import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicEnv } from './supabase-env';

// Cliente de sesión (anon key + cookies del usuario). Crear uno por petición.
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      'Configuración de Supabase incompleta: se requieren NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY',
    );
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Llamado desde un Server Component: no puede escribir cookies.
          // El proxy (src/proxy.ts) se encarga de refrescar la sesión.
        }
      },
    },
  });
}
