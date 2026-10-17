import type { LogisticsRequest } from '../entities/logistics-request.entity';
import type { SupplyCategory, UrgencyLevel } from '../types';

export interface VerifiedRequestFilters {
  region?: string;
  urgency?: UrgencyLevel;
  categories?: SupplyCategory[];
}

export interface ILogisticsRepository {
  save(request: LogisticsRequest): Promise<LogisticsRequest>;
  getVerified(filters?: VerifiedRequestFilters): Promise<LogisticsRequest[]>;
}
