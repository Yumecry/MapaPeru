import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Verifier, VerifierAccount } from '@/domain/entities/verifier.entity';
import {
  EmailTakenError,
  LastActiveAdminError,
} from '@/domain/repositories/verifier.repository';

const mocks = vi.hoisted(() => ({
  getVerifier: vi.fn<() => Promise<Verifier | null>>(),
  findByUserId: vi.fn<(id: string) => Promise<VerifierAccount | null>>(),
  create: vi.fn(),
  updateRole: vi.fn(),
  setDisabled: vi.fn(),
  setPassword: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('@/infrastructure/auth/session', () => ({ getVerifier: mocks.getVerifier }));
vi.mock('@/infrastructure/database/supabase-verifier.repository', () => ({
  SupabaseVerifierRepository: class {
    findByUserId = mocks.findByUserId;
    create = mocks.create;
    updateRole = mocks.updateRole;
    setDisabled = mocks.setDisabled;
    setPassword = mocks.setPassword;
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

const { changeVerifierRole, createVerifier, resetVerifierPassword, setVerifierDisabled } =
  await import('./actions');

const ADMIN_ID = '7d1c2f0a-1b2c-4d3e-8f9a-0b1c2d3e4f5a';
const OTHER_ID = '0b6f1c1e-5b9a-4a8e-9a43-2b7c5f0e9d11';
const ADMIN: Verifier = { userId: ADMIN_ID, email: 'admin@example.org', role: 'admin' };
const INITIAL = { error: null, notice: null };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const NEW_ACCOUNT = {
  email: 'nuevo@example.org',
  password: 'contraseña-larga',
  role: 'verificador',
};

describe('acciones de /admin', () => {
  beforeEach(() => {
    mocks.getVerifier.mockReset().mockResolvedValue(ADMIN);
    mocks.findByUserId.mockReset().mockImplementation(async (userId) => ({
      userId,
      email: 'equipo@example.org',
      role: 'verificador',
      createdAt: '2026-10-01T12:00:00.000Z',
    }));
    mocks.create.mockReset().mockImplementation(async (input) => ({
      userId: OTHER_ID,
      email: input.email,
      role: input.role,
      createdAt: '2026-10-18T12:00:00.000Z',
    }));
    mocks.updateRole.mockReset().mockResolvedValue(undefined);
    mocks.setDisabled.mockReset().mockResolvedValue(undefined);
    mocks.setPassword.mockReset().mockResolvedValue(undefined);
    mocks.revalidatePath.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('redirige a /login sin sesión', async () => {
    mocks.getVerifier.mockResolvedValue(null);
    await expect(createVerifier(INITIAL, form(NEW_ACCOUNT))).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rechaza a un verificador sin rol admin', async () => {
    mocks.getVerifier.mockResolvedValue({ ...ADMIN, role: 'verificador' });
    const state = await createVerifier(INITIAL, form(NEW_ACCOUNT));
    expect(state.error).toMatch(/Solo un administrador/);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('crea la cuenta, normaliza el correo y revalida la página', async () => {
    const state = await createVerifier(
      INITIAL,
      form({ ...NEW_ACCOUNT, email: ' Nuevo@Example.org ' }),
    );
    expect(state).toEqual({
      error: null,
      notice: expect.stringContaining('nuevo@example.org'),
    });
    expect(mocks.create).toHaveBeenCalledWith({ ...NEW_ACCOUNT, email: 'nuevo@example.org' });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin');
  });

  it('valida el formulario antes de consultar la sesión', async () => {
    const state = await createVerifier(INITIAL, form({ ...NEW_ACCOUNT, password: 'corta' }));
    expect(state.error).toMatch(/al menos 10/);
    expect(mocks.getVerifier).not.toHaveBeenCalled();
  });

  it('traduce un correo ya registrado', async () => {
    mocks.create.mockRejectedValue(new EmailTakenError('nuevo@example.org'));
    const state = await createVerifier(INITIAL, form(NEW_ACCOUNT));
    expect(state.error).toBe('Ya existe una cuenta con ese correo.');
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('cambia el rol de otra cuenta', async () => {
    const state = await changeVerifierRole(INITIAL, form({ userId: OTHER_ID, role: 'admin' }));
    expect(state.notice).toBe('Rol actualizado.');
    expect(mocks.updateRole).toHaveBeenCalledWith(OTHER_ID, 'admin');
  });

  it('impide que un admin se quite el rol a sí mismo', async () => {
    const state = await changeVerifierRole(
      INITIAL,
      form({ userId: ADMIN_ID, role: 'verificador' }),
    );
    expect(state.error).toMatch(/su propio rol/);
    expect(mocks.updateRole).not.toHaveBeenCalled();
  });

  it('traduce el bloqueo del último admin activo', async () => {
    mocks.setDisabled.mockRejectedValue(new LastActiveAdminError());
    const state = await setVerifierDisabled(INITIAL, form({ userId: OTHER_ID, disabled: 'true' }));
    expect(state.error).toBe('Debe quedar al menos un administrador activo.');
  });

  it.each([
    ['true', true, 'Cuenta desactivada.'],
    ['false', false, 'Cuenta reactivada.'],
  ])('disabled=%s', async (value, expected, notice) => {
    const state = await setVerifierDisabled(INITIAL, form({ userId: OTHER_ID, disabled: value }));
    expect(state.notice).toBe(notice);
    expect(mocks.setDisabled).toHaveBeenCalledWith(OTHER_ID, expected, expect.any(Date));
  });

  it('rechaza un valor de disabled inesperado', async () => {
    const state = await setVerifierDisabled(INITIAL, form({ userId: OTHER_ID, disabled: 'sí' }));
    expect(state.error).toBe('Acción inválida');
  });

  it('rechaza un userId que no es UUID', async () => {
    const state = await resetVerifierPassword(
      INITIAL,
      form({ userId: 'abc', password: 'contraseña-larga' }),
    );
    expect(state.error).toBe('Identificador de verificador inválido');
  });

  it('cambia la contraseña', async () => {
    const state = await resetVerifierPassword(
      INITIAL,
      form({ userId: OTHER_ID, password: 'contraseña-larga' }),
    );
    expect(state.error).toBeNull();
    expect(mocks.setPassword).toHaveBeenCalledWith(OTHER_ID, 'contraseña-larga');
  });

  it('oculta los errores internos y los registra', async () => {
    mocks.setPassword.mockRejectedValue(new Error('detalle interno'));
    const state = await resetVerifierPassword(
      INITIAL,
      form({ userId: OTHER_ID, password: 'contraseña-larga' }),
    );
    expect(state.error).toBe('Ocurrió un error interno. Inténtelo de nuevo más tarde.');
    expect(console.error).toHaveBeenCalled();
  });
});
