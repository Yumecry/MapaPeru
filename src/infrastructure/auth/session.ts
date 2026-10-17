import 'server-only';
import { z } from 'zod';
import { getSupabase } from '@/infrastructure/database/supabase.client';
import { createSupabaseServerClient } from './supabase-server';

export type VerifierRole = 'admin' | 'verificador';

export interface Verifier {
  userId: string;
  email: string;
  role: VerifierRole;
}

export type AuthState =
  | { kind: 'anonymous' }
  | { kind: 'forbidden'; userId: string }
  | { kind: 'verifier'; verifier: Verifier };

const VERIFIER_ROW_SCHEMA = z.object({
  user_id: z.string().uuid(),
  email: z.string(),
  role: z.enum(['admin', 'verificador']),
});

export async function findVerifierByUserId(userId: string): Promise<Verifier | null> {
  const { data, error } = await getSupabase()
    .from('verifiers')
    .select('user_id, email, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Error al consultar verificadores: ${error.message}`);
  }
  if (!data) return null;

  const parsed = VERIFIER_ROW_SCHEMA.safeParse(data);
  if (!parsed.success) {
    throw new Error('Fila de verificador con formato inesperado');
  }

  return { userId: parsed.data.user_id, email: parsed.data.email, role: parsed.data.role };
}

// getUser() valida el JWT contra Supabase Auth; getSession() solo lee la cookie.
export async function getAuthState(): Promise<AuthState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { kind: 'anonymous' };

  const verifier = await findVerifierByUserId(data.user.id);
  if (!verifier) return { kind: 'forbidden', userId: data.user.id };

  return { kind: 'verifier', verifier };
}

export async function getVerifier(): Promise<Verifier | null> {
  const state = await getAuthState();
  return state.kind === 'verifier' ? state.verifier : null;
}
