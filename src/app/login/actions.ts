'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/infrastructure/auth/supabase-server';
import { findVerifierByUserId } from '@/infrastructure/auth/session';
import { SupabaseRateLimiter } from '@/infrastructure/database/rate-limiter.repository';
import { getClientIp } from '@/infrastructure/http/client-ip';

export interface LoginState {
  error: string | null;
}

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

const credentialsSchema = z.object({
  email: z.string().trim().email('Ingrese un correo electrónico válido'),
  password: z.string().min(1, 'Ingrese su contraseña').max(200),
});

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos de acceso inválidos' };
  }

  try {
    const ip = getClientIp(await headers());
    const limit = await new SupabaseRateLimiter().consume(
      `login:${ip}`,
      LOGIN_LIMIT,
      LOGIN_WINDOW_SECONDS,
    );
    if (!limit.allowed) {
      return { error: 'Demasiados intentos. Inténtelo de nuevo en unos minutos.' };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) {
      return { error: 'Correo o contraseña incorrectos.' };
    }

    const verifier = await findVerifierByUserId(data.user.id);
    if (!verifier) {
      await supabase.auth.signOut();
      return { error: 'Su cuenta no tiene permisos de verificación.' };
    }
  } catch (error) {
    console.error('[login]', error);
    return { error: 'No se pudo iniciar sesión. Inténtelo de nuevo más tarde.' };
  }

  redirect('/verify');
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error('[logout]', error);
  }
  redirect('/login');
}
