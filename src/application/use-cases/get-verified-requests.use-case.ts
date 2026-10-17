import type { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import type {
  ILogisticsRepository,
  VerifiedRequestFilters,
} from '@/domain/repositories/logistics.repository';

export class GetVerifiedRequestsUseCase {
  constructor(private readonly logisticsRepository: ILogisticsRepository) {}

  async execute(filters?: VerifiedRequestFilters): Promise<LogisticsRequest[]> {
    return this.logisticsRepository.getVerified(filters);
  }
}
