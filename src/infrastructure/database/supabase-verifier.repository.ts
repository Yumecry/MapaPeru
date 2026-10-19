import 'server-only';
import { z } from 'zod';
import {
  isAuthApiError,
  isAuthWeakPasswordError,
  type PostgrestError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { getSupabase } from './supabase.client';
import type { VerifierAccount } from '@/domain/entities/verifier.entity';
import {
  EmailTakenError,
  LastActiveAdminError,
  WeakPasswordError,
  type IVerifierRepository,
  type NewVerifier,
} from '@/domain/repositories/verifier.repository';
import type { VerifierRole } from '@/domain/types';

const TABLE = 'verifiers';
const COLUMNS = 'user_id, email, role, created_at, disabled_at';

// Errores de Auth que significan "ese correo ya tiene cuenta".
const EMAIL_TAKEN_CODES = new Set(['email_exists', 'user_already_exists']);

const DB_ROW_SCHEMA = z.object({
  user_id: z.string().uuid(),
  email: z.string(),
  role: z.enum(['admin', 'verificador']),
  created_at: z.string(),
  disabled_at: z.string().nullable(),
});

type DbRow = z.infer<typeof DB_ROW_SCHEMA>;

function rowToAccount(row: DbRow): VerifierAccount {
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    disabledAt: row.disabled_at ?? undefined,
  };
}

function parseRow(data: unknown): VerifierAccount {
  const parsed = DB_ROW_SCHEMA.safeParse(data);
  if (!parsed.success) {
    throw new Error('Fila de verificador con formato inesperado');
  }
  return rowToAccount(parsed.data);
}

// El trigger ensure_active_admin (008) marca su excepción con HINT = 'last_active_admin'.
function throwWriteError(context: string, error: PostgrestError): never {
  if (error.hint === 'last_active_admin') {
    throw new LastActiveAdminError();
  }
  throw new Error(`${context}: ${error.message}`);
}

function toWeakPasswordError(error: unknown): WeakPasswordError | null {
  if (isAuthWeakPasswordError(error)) return new WeakPasswordError(error.reasons);
  if (isAuthApiError(error) && error.code === 'weak_password') return new WeakPasswordError();
  return null;
}

export class SupabaseVerifierRepository implements IVerifierRepository {
  constructor(private readonly getClient: () => SupabaseClient = getSupabase) {}

  async list(): Promise<VerifierAccount[]> {
    const { data, error } = await this.getClient()
      .from(TABLE)
      .select(COLUMNS)
      .order('disabled_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Error al listar verificadores: ${error.message}`);
    }
    return (data ?? []).map(parseRow);
  }

  async findByUserId(userId: string): Promise<VerifierAccount | null> {
    const { data, error } = await this.getClient()
      .from(TABLE)
      .select(COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al consultar el verificador: ${error.message}`);
    }
    return data ? parseRow(data) : null;
  }

  async create({ email, password, role }: NewVerifier): Promise<VerifierAccount> {
    const client = this.getClient();

    const { data: created, error: authError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError || !created.user) {
      if (isAuthApiError(authError) && authError.code && EMAIL_TAKEN_CODES.has(authError.code)) {
        throw new EmailTakenError(email);
      }
      const weak = toWeakPasswordError(authError);
      if (weak) throw weak;
      throw new Error(`Error al crear el usuario de Auth: ${authError?.message ?? 'sin usuario'}`);
    }

    const userId = created.user.id;
    const { data, error } = await client
      .from(TABLE)
      .insert({ user_id: userId, email, role })
      .select(COLUMNS)
      .single();

    if (error) {
      // Compensación: sin fila en verifiers el usuario de Auth quedaría huérfano y su
      // correo bloqueado para un nuevo alta.
      const { error: cleanupError } = await client.auth.admin.deleteUser(userId);
      if (cleanupError) {
        console.error('[verifiers] no se pudo borrar el usuario huérfano', userId, cleanupError);
      }
      if (error.code === '23505') throw new EmailTakenError(email);
      throw new Error(`Error al registrar el verificador: ${error.message}`);
    }

    return parseRow(data);
  }

  async updateRole(userId: string, role: VerifierRole): Promise<void> {
    const { error } = await this.getClient().from(TABLE).update({ role }).eq('user_id', userId);
    if (error) throwWriteError('Error al cambiar el rol', error);
  }

  async setDisabled(userId: string, disabled: boolean, now: Date): Promise<void> {
    const { error } = await this.getClient()
      .from(TABLE)
      .update({ disabled_at: disabled ? now.toISOString() : null })
      .eq('user_id', userId);
    if (error) throwWriteError('Error al cambiar el estado de la cuenta', error);
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const { error } = await this.getClient().auth.admin.updateUserById(userId, { password });
    if (error) {
      const weak = toWeakPasswordError(error);
      if (weak) throw weak;
      throw new Error(`Error al cambiar la contraseña: ${error.message}`);
    }
  }
}
