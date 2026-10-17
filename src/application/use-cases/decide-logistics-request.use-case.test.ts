import { describe, expect, it } from 'vitest';
import { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import {
  StatusConflictError,
  type ILogisticsRepository,
} from '@/domain/repositories/logistics.repository';
import type { VerifyStatus } from '@/domain/types';
import {
  DecideLogisticsRequestUseCase,
  LogisticsRequestNotFoundError,
} from './decide-logistics-request.use-case';
import { GetPendingRequestsUseCase } from './get-pending-requests.use-case';

const REQUEST_ID = '0b6f1c1e-5b9a-4a8e-9a43-2b7c5f0e9d11';
const VERIFIER_ID = '7d1c2f0a-1b2c-4d3e-8f9a-0b1c2d3e4f5a';
const NOW = new Date('2026-10-16T15:30:00.000Z');

function buildRequest(id = REQUEST_ID, status: VerifyStatus = 'pendiente'): LogisticsRequest {
  return LogisticsRequest.fromPrimitives({
    id,
    contact: { fullName: 'Juan Mamani', phone: '987654321', region: 'Puno', district: 'Juliaca' },
    latitude: -15.5,
    longitude: -70.13,
    categories: ['agua'],
    urgency: 'critico',
    description: 'Sin agua potable',
    status,
    createdAt: '2026-10-15T12:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
  });
}

class FakeLogisticsRepository implements ILogisticsRepository {
  readonly decisions: LogisticsRequest[] = [];
  conflictOnSave = false;

  constructor(private readonly rows: Map<string, LogisticsRequest> = new Map()) {}

  async save(request: LogisticsRequest): Promise<LogisticsRequest> {
    this.rows.set(request.id, request);
    return request;
  }

  async getVerified(): Promise<LogisticsRequest[]> {
    return [...this.rows.values()].filter((r) => r.status === 'verificado');
  }

  async findPending(): Promise<LogisticsRequest[]> {
    return [...this.rows.values()].filter((r) => r.status === 'pendiente');
  }

  async findById(id: string): Promise<LogisticsRequest | null> {
    return this.rows.get(id) ?? null;
  }

  async saveDecision(request: LogisticsRequest): Promise<LogisticsRequest> {
    const current = this.rows.get(request.id);
    if (this.conflictOnSave || !current || current.status !== 'pendiente') {
      throw new StatusConflictError(request.id);
    }
    this.decisions.push(request);
    this.rows.set(request.id, request);
    return request;
  }
}

function repoWith(...requests: LogisticsRequest[]): FakeLogisticsRepository {
  return new FakeLogisticsRepository(new Map(requests.map((r) => [r.id, r])));
}

describe('DecideLogisticsRequestUseCase', () => {
  it('verifica una solicitud pendiente con el verificador y la hora del reloj', async () => {
    const repo = repoWith(buildRequest());
    const result = await new DecideLogisticsRequestUseCase(repo, () => NOW).execute({
      requestId: REQUEST_ID,
      verifierId: VERIFIER_ID,
      decision: { status: 'verificado' },
    });

    expect(result.status).toBe('verificado');
    expect(result.verifiedBy).toBe(VERIFIER_ID);
    expect(result.verifiedAt).toBe(NOW.toISOString());
    expect(repo.decisions).toHaveLength(1);
    expect(await repo.getVerified()).toHaveLength(1);
  });

  it('rechaza con motivo y la solicitud sale de la cola de pendientes', async () => {
    const repo = repoWith(buildRequest());
    const result = await new DecideLogisticsRequestUseCase(repo, () => NOW).execute({
      requestId: REQUEST_ID,
      verifierId: VERIFIER_ID,
      decision: { status: 'rechazado', reason: 'Número inexistente' },
    });

    expect(result.status).toBe('rechazado');
    expect(result.rejectionReason).toBe('Número inexistente');
    expect(await new GetPendingRequestsUseCase(repo).execute()).toHaveLength(0);
    expect(await repo.getVerified()).toHaveLength(0);
  });

  it('lanza LogisticsRequestNotFoundError si no existe', async () => {
    const repo = repoWith();
    await expect(
      new DecideLogisticsRequestUseCase(repo).execute({
        requestId: REQUEST_ID,
        verifierId: VERIFIER_ID,
        decision: { status: 'verificado' },
      }),
    ).rejects.toBeInstanceOf(LogisticsRequestNotFoundError);
  });

  it.each(['verificado', 'rechazado'] as const)(
    'lanza StatusConflictError si ya está %s y no guarda',
    async (status) => {
      const repo = repoWith(buildRequest(REQUEST_ID, status));
      await expect(
        new DecideLogisticsRequestUseCase(repo).execute({
          requestId: REQUEST_ID,
          verifierId: VERIFIER_ID,
          decision: { status: 'verificado' },
        }),
      ).rejects.toBeInstanceOf(StatusConflictError);
      expect(repo.decisions).toHaveLength(0);
    },
  );

  it('propaga el conflicto si otra persona decidió entre la lectura y la escritura', async () => {
    const repo = repoWith(buildRequest());
    repo.conflictOnSave = true;
    await expect(
      new DecideLogisticsRequestUseCase(repo).execute({
        requestId: REQUEST_ID,
        verifierId: VERIFIER_ID,
        decision: { status: 'rechazado', reason: 'Duplicada' },
      }),
    ).rejects.toBeInstanceOf(StatusConflictError);
  });
});

describe('GetPendingRequestsUseCase', () => {
  it('devuelve solo las pendientes', async () => {
    const repo = repoWith(
      buildRequest(),
      buildRequest('1b6f1c1e-5b9a-4a8e-9a43-2b7c5f0e9d11', 'verificado'),
      buildRequest('2b6f1c1e-5b9a-4a8e-9a43-2b7c5f0e9d11', 'rechazado'),
    );
    const pending = await new GetPendingRequestsUseCase(repo).execute();
    expect(pending.map((r) => r.id)).toEqual([REQUEST_ID]);
  });
});
