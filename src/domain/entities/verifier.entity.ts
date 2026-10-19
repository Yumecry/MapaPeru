import type { VerifierRole } from '../types';

export interface Verifier {
  userId: string;
  email: string;
  role: VerifierRole;
}

/** Cuenta tal como la ve el panel de administración (incluye las desactivadas). */
export interface VerifierAccount extends Verifier {
  createdAt: string;
  disabledAt?: string;
}
