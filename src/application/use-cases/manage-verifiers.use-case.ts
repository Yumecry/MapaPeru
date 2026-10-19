import type { Verifier, VerifierAccount } from '@/domain/entities/verifier.entity';
import type { IVerifierRepository, NewVerifier } from '@/domain/repositories/verifier.repository';
import type { VerifierRole } from '@/domain/types';

export class NotAdminError extends Error {
  constructor() {
    super('Solo un administrador puede gestionar verificadores');
    this.name = 'NotAdminError';
  }
}

export class SelfModificationError extends Error {
  constructor() {
    super('No puede cambiar su propio rol ni desactivar su propia cuenta');
    this.name = 'SelfModificationError';
  }
}

export class VerifierNotFoundError extends Error {
  constructor(readonly userId: string) {
    super(`No existe el verificador ${userId}`);
    this.name = 'VerifierNotFoundError';
  }
}

// `actor` es quien ejecuta la acción, ya autenticado y activo. La regla de "al menos un
// admin activo" la garantiza la base de datos (LastActiveAdminError).
export class ManageVerifiersUseCase {
  constructor(
    private readonly verifierRepository: IVerifierRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(actor: Verifier): Promise<VerifierAccount[]> {
    requireAdmin(actor);
    return this.verifierRepository.list();
  }

  async create(actor: Verifier, input: NewVerifier): Promise<VerifierAccount> {
    requireAdmin(actor);
    return this.verifierRepository.create(input);
  }

  async changeRole(actor: Verifier, userId: string, role: VerifierRole): Promise<void> {
    requireAdmin(actor);
    if (userId === actor.userId) throw new SelfModificationError();
    await this.requireTarget(userId);
    await this.verifierRepository.updateRole(userId, role);
  }

  async setDisabled(actor: Verifier, userId: string, disabled: boolean): Promise<void> {
    requireAdmin(actor);
    if (userId === actor.userId) throw new SelfModificationError();
    await this.requireTarget(userId);
    await this.verifierRepository.setDisabled(userId, disabled, this.clock());
  }

  async resetPassword(actor: Verifier, userId: string, password: string): Promise<void> {
    requireAdmin(actor);
    await this.requireTarget(userId);
    await this.verifierRepository.setPassword(userId, password);
  }

  private async requireTarget(userId: string): Promise<VerifierAccount> {
    const target = await this.verifierRepository.findByUserId(userId);
    if (!target) throw new VerifierNotFoundError(userId);
    return target;
  }
}

function requireAdmin(actor: Verifier): void {
  if (actor.role !== 'admin') throw new NotAdminError();
}
