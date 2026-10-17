import { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import type { ILogisticsRepository } from '@/domain/repositories/logistics.repository';
import {
  logisticsRequestSchema,
  type LogisticsRequestInput,
} from '@/application/schemas/logistics-request.schema';

export class SubmitLogisticsRequestUseCase {
  constructor(private readonly logisticsRepository: ILogisticsRepository) {}

  async execute(rawInput: unknown): Promise<LogisticsRequest> {
    const input: LogisticsRequestInput = logisticsRequestSchema.parse(rawInput);
    const request = LogisticsRequest.create({
      contact: {
        fullName: input.fullName,
        phone: input.phone,
        region: input.region,
        district: input.district,
      },
      latitude: input.latitude,
      longitude: input.longitude,
      categories: input.categories,
      urgency: input.urgency,
      description: input.description,
    });
    return this.logisticsRepository.save(request);
  }
}
