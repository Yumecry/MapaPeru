import type { LogisticsRequest } from '../entities/logistics-request.entity';
import type { SupplyCategory, UrgencyLevel } from '../types';

export interface VerifiedRequestFilters {
  region?: string;
  urgency?: UrgencyLevel;
  categories?: SupplyCategory[];
}

export class StatusConflictError extends Error {
  constructor(readonly requestId: string) {
    super(`La solicitud ${requestId} ya no está pendiente`);
    this.name = 'StatusConflictError';
  }
}

export interface ILogisticsRepository {
  save(request: LogisticsRequest): Promise<LogisticsRequest>;
  getVerified(filters?: VerifiedRequestFilters): Promise<LogisticsRequest[]>;
  findPending(): Promise<LogisticsRequest[]>;
  findById(id: string): Promise<LogisticsRequest | null>;
  /**
   * Persiste la decisión (status, verifiedBy, verifiedAt, rejectionReason) solo si la
   * fila sigue 'pendiente'; si no, lanza StatusConflictError.
   */
  saveDecision(request: LogisticsRequest): Promise<LogisticsRequest>;
}
