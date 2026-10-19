import { describe, expect, it } from 'vitest';
import type { Verifier, VerifierAccount } from '@/domain/entities/verifier.entity';
import type { IVerifierRepository, NewVerifier } from '@/domain/repositories/verifier.repository';
import type { VerifierRole } from '@/domain/types';
import {
  ManageVerifiersUseCase,
  NotAdminError,
  SelfModificationError,
  VerifierNotFoundError,
} from './manage-verifiers.use-case';

const ADMIN_ID = '7d1c2f0a-1b2c-4d3e-8f9a-0b1c2d3e4f5a';
const OTHER_ID = '0b6f1c1e-5b9a-4a8e-9a43-2b7c5f0e9d11';
const MISSING_ID = '1b6f1c1e-5b9a-4a8e-9a43-2b7c5f0e9d11';
const NOW = new Date('2026-10-18T15:30:00.000Z');

const ADMIN: Verifier = { userId: ADMIN_ID, email: 'admin@example.org', role: 'admin' };
const VERIFIER: Verifier = { userId: OTHER_ID, email: 'equipo@example.org', role: 'verificador' };

function account(verifier: Verifier): VerifierAccount {
  return { ...verifier, createdAt: '2026-10-01T12:00:00.000Z' };
}

class FakeVerifierRepository implements IVerifierRepository {
  readonly calls: string[] = [];
  readonly rows = new Map<string, VerifierAccount>([
    [ADMIN_ID, account(ADMIN)],
    [OTHER_ID, account(VERIFIER)],
  ]);

  async list(): Promise<VerifierAccount[]> {
    return [...this.rows.values()];
  }

  async findByUserId(userId: string): Promise<VerifierAccount | null> {
    return this.rows.get(userId) ?? null;
  }

  async create({ email, role }: NewVerifier): Promise<VerifierAccount> {
    this.calls.push(`create:${email}`);
    return { userId: MISSING_ID, email, role, createdAt: NOW.toISOString() };
  }

  async updateRole(userId: string, role: VerifierRole): Promise<void> {
    this.calls.push(`role:${userId}:${role}`);
  }

  async setDisabled(userId: string, disabled: boolean, now: Date): Promise<void> {
    this.calls.push(`disabled:${userId}:${disabled}:${now.toISOString()}`);
  }

  async setPassword(userId: string): Promise<void> {
    this.calls.push(`password:${userId}`);
  }
}

function setup() {
  const repo = new FakeVerifierRepository();
  return { repo, useCase: new ManageVerifiersUseCase(repo, () => NOW) };
}

describe('ManageVerifiersUseCase', () => {
  it('un admin lista las cuentas', async () => {
    const { useCase } = setup();
    expect(await useCase.list(ADMIN)).toHaveLength(2);
  });

  it('un admin crea una cuenta', async () => {
    const { repo, useCase } = setup();
    const created = await useCase.create(ADMIN, {
      email: 'nuevo@example.org',
      password: 'contraseña-larga',
      role: 'verificador',
    });
    expect(created.email).toBe('nuevo@example.org');
    expect(repo.calls).toEqual(['create:nuevo@example.org']);
  });

  it('un admin cambia el rol de otra cuenta', async () => {
    const { repo, useCase } = setup();
    await useCase.changeRole(ADMIN, OTHER_ID, 'admin');
    expect(repo.calls).toEqual([`role:${OTHER_ID}:admin`]);
  });

  it('desactiva y reactiva con la hora del reloj', async () => {
    const { repo, useCase } = setup();
    await useCase.setDisabled(ADMIN, OTHER_ID, true);
    await useCase.setDisabled(ADMIN, OTHER_ID, false);
    expect(repo.calls).toEqual([
      `disabled:${OTHER_ID}:true:${NOW.toISOString()}`,
      `disabled:${OTHER_ID}:false:${NOW.toISOString()}`,
    ]);
  });

  it('un admin puede cambiar su propia contraseña y la de otros', async () => {
    const { repo, useCase } = setup();
    await useCase.resetPassword(ADMIN, ADMIN_ID, 'contraseña-larga');
    await useCase.resetPassword(ADMIN, OTHER_ID, 'contraseña-larga');
    expect(repo.calls).toEqual([`password:${ADMIN_ID}`, `password:${OTHER_ID}`]);
  });

  it.each([
    ['list', (u: ManageVerifiersUseCase) => u.list(VERIFIER)],
    [
      'create',
      (u: ManageVerifiersUseCase) =>
        u.create(VERIFIER, { email: 'x@example.org', password: 'contraseña-larga', role: 'admin' }),
    ],
    ['changeRole', (u: ManageVerifiersUseCase) => u.changeRole(VERIFIER, ADMIN_ID, 'verificador')],
    ['setDisabled', (u: ManageVerifiersUseCase) => u.setDisabled(VERIFIER, ADMIN_ID, true)],
    ['resetPassword', (u: ManageVerifiersUseCase) => u.resetPassword(VERIFIER, ADMIN_ID, 'x'.repeat(12))],
  ])('un verificador no puede usar %s', async (_name, call) => {
    const { repo, useCase } = setup();
    await expect(call(useCase)).rejects.toBeInstanceOf(NotAdminError);
    expect(repo.calls).toHaveLength(0);
  });

  it('un admin no puede cambiar su propio rol ni desactivarse', async () => {
    const { repo, useCase } = setup();
    await expect(useCase.changeRole(ADMIN, ADMIN_ID, 'verificador')).rejects.toBeInstanceOf(
      SelfModificationError,
    );
    await expect(useCase.setDisabled(ADMIN, ADMIN_ID, true)).rejects.toBeInstanceOf(
      SelfModificationError,
    );
    expect(repo.calls).toHaveLength(0);
  });

  it('lanza VerifierNotFoundError si la cuenta no existe', async () => {
    const { repo, useCase } = setup();
    await expect(useCase.changeRole(ADMIN, MISSING_ID, 'admin')).rejects.toBeInstanceOf(
      VerifierNotFoundError,
    );
    await expect(useCase.setDisabled(ADMIN, MISSING_ID, true)).rejects.toBeInstanceOf(
      VerifierNotFoundError,
    );
    await expect(
      useCase.resetPassword(ADMIN, MISSING_ID, 'contraseña-larga'),
    ).rejects.toBeInstanceOf(VerifierNotFoundError);
    expect(repo.calls).toHaveLength(0);
  });
});
