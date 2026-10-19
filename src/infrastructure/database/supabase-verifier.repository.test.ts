import { describe, expect, it, vi } from 'vitest';
import {
  AuthApiError,
  AuthWeakPasswordError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import {
  EmailTakenError,
  LastActiveAdminError,
  WeakPasswordError,
} from '@/domain/repositories/verifier.repository';
import { SupabaseVerifierRepository } from './supabase-verifier.repository';

const USER_ID = '0b6f1c1e-5b9a-4a8e-9a43-2b7c5f0e9d11';

interface Result {
  data: unknown;
  error: { message: string; code?: string; hint?: string } | null;
}

const ROW = {
  user_id: USER_ID,
  email: 'equipo@example.org',
  role: 'verificador',
  created_at: '2026-10-01T12:00:00.000Z',
  disabled_at: null,
};

// Query builder encadenable de PostgREST: cada método registra la llamada y devuelve el
// mismo objeto, que al hacer `await` (o .single/.maybeSingle) resuelve `result`.
function fakeQuery(result: Result) {
  const calls: [string, unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'update', 'eq', 'is', 'order']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (resolve: (value: Result) => unknown) => resolve(result);
  return { builder, calls };
}

function fakeClient({
  query = { data: null, error: null },
  createUser = { data: { user: { id: USER_ID } }, error: null },
  updateUserById = { data: { user: { id: USER_ID } }, error: null },
}: {
  query?: Result;
  createUser?: { data: unknown; error: unknown };
  updateUserById?: { data: unknown; error: unknown };
} = {}) {
  const { builder, calls } = fakeQuery(query);
  const admin = {
    createUser: vi.fn().mockResolvedValue(createUser),
    updateUserById: vi.fn().mockResolvedValue(updateUserById),
    deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };
  const from = vi.fn().mockReturnValue(builder);
  const client = { from, auth: { admin } } as unknown as SupabaseClient;
  return { admin, from, calls, repo: new SupabaseVerifierRepository(() => client) };
}

describe('SupabaseVerifierRepository', () => {
  it('lista las cuentas mapeando disabled_at y ordenando activas primero', async () => {
    const { calls, repo } = fakeClient({
      query: { data: [ROW, { ...ROW, disabled_at: '2026-10-10T00:00:00.000Z' }], error: null },
    });

    const accounts = await repo.list();

    expect(accounts).toEqual([
      { userId: USER_ID, email: ROW.email, role: 'verificador', createdAt: ROW.created_at, disabledAt: undefined },
      {
        userId: USER_ID,
        email: ROW.email,
        role: 'verificador',
        createdAt: ROW.created_at,
        disabledAt: '2026-10-10T00:00:00.000Z',
      },
    ]);
    expect(calls).toContainEqual(['order', ['disabled_at', { ascending: true, nullsFirst: true }]]);
  });

  it('lanza ante una fila con formato inesperado', async () => {
    const { repo } = fakeClient({ query: { data: [{ ...ROW, role: 'root' }], error: null } });
    await expect(repo.list()).rejects.toThrow('formato inesperado');
  });

  it('crea el usuario de Auth confirmado y su fila de verificador', async () => {
    const { admin, from, calls, repo } = fakeClient({ query: { data: ROW, error: null } });

    const account = await repo.create({
      email: ROW.email,
      password: 'contraseña-larga',
      role: 'verificador',
    });

    expect(admin.createUser).toHaveBeenCalledWith({
      email: ROW.email,
      password: 'contraseña-larga',
      email_confirm: true,
    });
    expect(from).toHaveBeenCalledWith('verifiers');
    expect(calls).toContainEqual([
      'insert',
      [{ user_id: USER_ID, email: ROW.email, role: 'verificador' }],
    ]);
    expect(account.userId).toBe(USER_ID);
    expect(admin.deleteUser).not.toHaveBeenCalled();
  });

  it.each(['email_exists', 'user_already_exists'])(
    'lanza EmailTakenError si Auth responde %s',
    async (code) => {
      const { from, repo } = fakeClient({
        createUser: { data: { user: null }, error: new AuthApiError('exists', 422, code) },
      });
      await expect(
        repo.create({ email: ROW.email, password: 'contraseña-larga', role: 'admin' }),
      ).rejects.toBeInstanceOf(EmailTakenError);
      expect(from).not.toHaveBeenCalled();
    },
  );

  it('lanza WeakPasswordError si Auth rechaza la contraseña', async () => {
    const { repo } = fakeClient({
      createUser: {
        data: { user: null },
        error: new AuthWeakPasswordError('weak', 422, ['characters']),
      },
    });
    await expect(
      repo.create({ email: ROW.email, password: 'contraseña-larga', role: 'admin' }),
    ).rejects.toEqual(new WeakPasswordError(['characters']));
  });

  it('borra el usuario de Auth si falla el insert en verifiers', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { admin, repo } = fakeClient({ query: { data: null, error: { message: 'boom' } } });

    await expect(
      repo.create({ email: ROW.email, password: 'contraseña-larga', role: 'admin' }),
    ).rejects.toThrow('Error al registrar el verificador: boom');
    expect(admin.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('traduce un email duplicado en verifiers a EmailTakenError (tras compensar)', async () => {
    const { admin, repo } = fakeClient({
      query: { data: null, error: { message: 'duplicate', code: '23505' } },
    });
    await expect(
      repo.create({ email: ROW.email, password: 'contraseña-larga', role: 'admin' }),
    ).rejects.toBeInstanceOf(EmailTakenError);
    expect(admin.deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it('desactiva con la fecha recibida y reactiva con null', async () => {
    const now = new Date('2026-10-18T15:30:00.000Z');
    const first = fakeClient();
    await first.repo.setDisabled(USER_ID, true, now);
    expect(first.calls).toContainEqual(['update', [{ disabled_at: now.toISOString() }]]);
    expect(first.calls).toContainEqual(['eq', ['user_id', USER_ID]]);

    const second = fakeClient();
    await second.repo.setDisabled(USER_ID, false, now);
    expect(second.calls).toContainEqual(['update', [{ disabled_at: null }]]);
  });

  it.each([
    ['updateRole', (r: SupabaseVerifierRepository) => r.updateRole(USER_ID, 'verificador')],
    ['setDisabled', (r: SupabaseVerifierRepository) => r.setDisabled(USER_ID, true, new Date())],
  ])('%s traduce el aviso del trigger a LastActiveAdminError', async (_name, call) => {
    const { repo } = fakeClient({
      query: {
        data: null,
        error: { message: 'Debe quedar…', code: 'P0001', hint: 'last_active_admin' },
      },
    });
    await expect(call(repo)).rejects.toBeInstanceOf(LastActiveAdminError);
  });

  it('cambia la contraseña con la API de administración', async () => {
    const { admin, repo } = fakeClient();
    await repo.setPassword(USER_ID, 'otra-contraseña');
    expect(admin.updateUserById).toHaveBeenCalledWith(USER_ID, { password: 'otra-contraseña' });
  });

  it('setPassword lanza WeakPasswordError con el código weak_password', async () => {
    const { repo } = fakeClient({
      updateUserById: { data: { user: null }, error: new AuthApiError('weak', 422, 'weak_password') },
    });
    await expect(repo.setPassword(USER_ID, 'otra-contraseña')).rejects.toBeInstanceOf(
      WeakPasswordError,
    );
  });
});
