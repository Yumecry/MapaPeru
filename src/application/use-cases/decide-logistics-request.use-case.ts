import {
  InvalidStatusTransitionError,
  type LogisticsRequest,
} from '@/domain/entities/logistics-request.entity';
import {
  StatusConflictError,
  type ILogisticsRepository,
} from '@/domain/repositories/logistics.repository';

export type VerificationDecision =
  | { status: 'verificado' }
  | { status: 'rechazado'; reason: string };

export interface DecideLogisticsRequestInput {
  requestId: string;
  verifierId: string;
  decision: VerificationDecision;
}

export class LogisticsRequestNotFoundError extends Error {
  constructor(readonly requestId: string) {
    super(`No existe la solicitud ${requestId}`);
    this.name = 'LogisticsRequestNotFoundError';
  }
}

export class DecideLogisticsRequestUseCase {
  constructor(
    private readonly logisticsRepository: ILogisticsRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute({
    requestId,
    verifierId,
    decision,
  }: DecideLogisticsRequestInput): Promise<LogisticsRequest> {
    const current = await this.logisticsRepository.findById(requestId);
    if (!current) {
      throw new LogisticsRequestNotFoundError(requestId);
    }

    let decided: LogisticsRequest;
    try {
      decided =
        decision.status === 'verificado'
          ? current.verify(verifierId, this.clock())
          : current.reject(verifierId, decision.reason, this.clock());
    } catch (error) {
      if (error instanceof InvalidStatusTransitionError) {
        throw new StatusConflictError(requestId);
      }
      throw error;
    }

    return this.logisticsRepository.saveDecision(decided);
  }
}
