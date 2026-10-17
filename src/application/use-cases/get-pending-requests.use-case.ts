import type { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import type { ILogisticsRepository } from '@/domain/repositories/logistics.repository';

export class GetPendingRequestsUseCase {
  constructor(private readonly logisticsRepository: ILogisticsRepository) {}

  async execute(): Promise<LogisticsRequest[]> {
    return this.logisticsRepository.findPending();
  }
}
