import type { VerifierAccount } from '../entities/verifier.entity';
import type { VerifierRole } from '../types';

export interface NewVerifier {
  email: string;
  password: string;
  role: VerifierRole;
}

export class EmailTakenError extends Error {
  constructor(readonly email: string) {
    super(`Ya existe una cuenta con el correo ${email}`);
    this.name = 'EmailTakenError';
  }
}

/** La política de contraseñas de Supabase Auth rechazó la contraseña. */
export class WeakPasswordError extends Error {
  constructor(readonly reasons: string[] = []) {
    super('La contraseña no cumple la política de seguridad');
    this.name = 'WeakPasswordError';
  }
}

export class LastActiveAdminError extends Error {
  constructor() {
    super('Debe quedar al menos un administrador activo');
    this.name = 'LastActiveAdminError';
  }
}

export interface IVerifierRepository {
  /** Todas las cuentas, activas primero y luego por fecha de alta. */
  list(): Promise<VerifierAccount[]>;
  findByUserId(userId: string): Promise<VerifierAccount | null>;
  /**
   * Crea el usuario de Auth (ya confirmado) y su fila en verifiers.
   * Lanza EmailTakenError o WeakPasswordError.
   */
  create(input: NewVerifier): Promise<VerifierAccount>;
  /** Lanza LastActiveAdminError si el cambio deja el sistema sin admins activos. */
  updateRole(userId: string, role: VerifierRole): Promise<void>;
  /** Activa o desactiva la cuenta. Lanza LastActiveAdminError como updateRole. */
  setDisabled(userId: string, disabled: boolean, now: Date): Promise<void>;
  /** Lanza WeakPasswordError. */
  setPassword(userId: string, password: string): Promise<void>;
}
