'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { z } from 'zod';
import { getVerifier } from '@/infrastructure/auth/session';
import { SupabaseVerifierRepository } from '@/infrastructure/database/supabase-verifier.repository';
import {
  EmailTakenError,
  LastActiveAdminError,
  WeakPasswordError,
} from '@/domain/repositories/verifier.repository';
import {
  ManageVerifiersUseCase,
  NotAdminError,
  SelfModificationError,
  VerifierNotFoundError,
} from '@/application/use-cases/manage-verifiers.use-case';
import {
  newVerifierSchema,
  passwordSchema,
  verifierIdSchema,
  verifierRoleSchema,
} from '@/application/schemas/verifier-admin.schema';
import type { Verifier } from '@/domain/entities/verifier.entity';

export interface AdminActionState {
  error: string | null;
  notice: string | null;
}

const ADMIN_PATH = '/admin';

function failure(error: string): AdminActionState {
  return { error, notice: null };
}

function firstIssue(error: z.ZodError, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}

function errorMessage(error: unknown): string | null {
  if (error instanceof NotAdminError) return 'Solo un administrador puede gestionar verificadores.';
  if (error instanceof SelfModificationError) {
    return 'No puede cambiar su propio rol ni desactivar su propia cuenta.';
  }
  if (error instanceof VerifierNotFoundError) return 'La cuenta ya no existe.';
  if (error instanceof EmailTakenError) return 'Ya existe una cuenta con ese correo.';
  if (error instanceof LastActiveAdminError) return 'Debe quedar al menos un administrador activo.';
  if (error instanceof WeakPasswordError) {
    return 'La contraseña no cumple la política de seguridad de Supabase. Use una más larga y variada.';
  }
  return null;
}

// Revalida sesión y cuenta activa en cada acción; el rol lo exige el caso de uso.
async function run(
  context: string,
  action: (useCase: ManageVerifiersUseCase, actor: Verifier) => Promise<string>,
): Promise<AdminActionState> {
  let actor: Verifier | null;
  try {
    actor = await getVerifier();
  } catch (error) {
    console.error(`[admin ${context}]`, error);
    return failure('No se pudo comprobar su sesión. Inténtelo de nuevo.');
  }
  if (!actor) redirect('/login');

  try {
    const notice = await action(new ManageVerifiersUseCase(new SupabaseVerifierRepository()), actor);
    revalidatePath(ADMIN_PATH);
    return { error: null, notice };
  } catch (error) {
    const known = errorMessage(error);
    if (known) return failure(known);
    console.error(`[admin ${context}]`, error);
    return failure('Ocurrió un error interno. Inténtelo de nuevo más tarde.');
  }
}

export async function createVerifier(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = newVerifierSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  });
  if (!parsed.success) return failure(firstIssue(parsed.error, 'Datos inválidos'));

  return run('create', async (useCase, actor) => {
    const account = await useCase.create(actor, parsed.data);
    return `Cuenta creada para ${account.email}. Comparta la contraseña por un canal seguro.`;
  });
}

export async function changeVerifierRole(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const userId = verifierIdSchema.safeParse(formData.get('userId'));
  if (!userId.success) return failure(firstIssue(userId.error, 'Cuenta inválida'));
  const role = verifierRoleSchema.safeParse(formData.get('role'));
  if (!role.success) return failure(firstIssue(role.error, 'Rol inválido'));

  return run('role', async (useCase, actor) => {
    await useCase.changeRole(actor, userId.data, role.data);
    return 'Rol actualizado.';
  });
}

export async function setVerifierDisabled(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const userId = verifierIdSchema.safeParse(formData.get('userId'));
  if (!userId.success) return failure(firstIssue(userId.error, 'Cuenta inválida'));
  const disabled = formData.get('disabled');
  if (disabled !== 'true' && disabled !== 'false') return failure('Acción inválida');

  return run('status', async (useCase, actor) => {
    await useCase.setDisabled(actor, userId.data, disabled === 'true');
    return disabled === 'true' ? 'Cuenta desactivada.' : 'Cuenta reactivada.';
  });
}

export async function resetVerifierPassword(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const userId = verifierIdSchema.safeParse(formData.get('userId'));
  if (!userId.success) return failure(firstIssue(userId.error, 'Cuenta inválida'));
  const password = passwordSchema.safeParse(formData.get('password'));
  if (!password.success) return failure(firstIssue(password.error, 'Contraseña inválida'));

  return run('password', async (useCase, actor) => {
    await useCase.resetPassword(actor, userId.data, password.data);
    return 'Contraseña cambiada. Comparta la nueva por un canal seguro.';
  });
}
