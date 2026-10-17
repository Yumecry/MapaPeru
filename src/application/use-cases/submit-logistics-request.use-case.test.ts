import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import type { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import type { ILogisticsRepository } from '@/domain/repositories/logistics.repository';
import { SubmitLogisticsRequestUseCase } from './submit-logistics-request.use-case';

const VALID_INPUT = {
  fullName: 'Rosa Huamán',
  phone: '+51 987654321',
  region: 'Cusco',
  district: 'Urubamba',
  latitude: -13.3,
  longitude: -72.1,
  categories: ['agua', 'herramientas'],
  urgency: 'moderado',
  description: 'Faltan herramientas para cortafuegos',
};

class FakeLogisticsRepository implements ILogisticsRepository {
  readonly saved: LogisticsRequest[] = [];

  async save(request: LogisticsRequest): Promise<LogisticsRequest> {
    this.saved.push(request);
    return request;
  }

  async getVerified(): Promise<LogisticsRequest[]> {
    return [];
  }
}

describe('SubmitLogisticsRequestUseCase', () => {
  it("guarda la solicitud con isVerified 'pendiente'", async () => {
    const repo = new FakeLogisticsRepository();
    const result = await new SubmitLogisticsRequestUseCase(repo).execute(VALID_INPUT);

    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0]).toBe(result);
    expect(result.isVerified).toBe('pendiente');
    expect(result.contact).toEqual({
      fullName: 'Rosa Huamán',
      phone: '+51 987654321',
      region: 'Cusco',
      district: 'Urubamba',
    });
    expect([...result.categories]).toEqual(['agua', 'herramientas']);
  });

  it.each([
    ['isVerified', { isVerified: 'verificado' }],
    ['is_verified', { is_verified: true }],
    ['ambos', { isVerified: 'verificado', is_verified: true, id: 'forzado' }],
  ])("ignora el intento de forzar la verificación (%s)", async (_label, extra) => {
    const repo = new FakeLogisticsRepository();
    await new SubmitLogisticsRequestUseCase(repo).execute({ ...VALID_INPUT, ...extra });

    expect(repo.saved[0].isVerified).toBe('pendiente');
    expect(repo.saved[0].id).not.toBe('forzado');
  });

  it('lanza ZodError con entrada inválida y no guarda nada', async () => {
    const repo = new FakeLogisticsRepository();
    const useCase = new SubmitLogisticsRequestUseCase(repo);

    await expect(useCase.execute({ ...VALID_INPUT, categories: [] })).rejects.toBeInstanceOf(
      ZodError,
    );
    await expect(useCase.execute(null)).rejects.toBeInstanceOf(ZodError);
    expect(repo.saved).toHaveLength(0);
  });

  it('propaga los errores del repositorio', async () => {
    const repo = new FakeLogisticsRepository();
    repo.save = async () => {
      throw new Error('fallo de BD');
    };
    await expect(new SubmitLogisticsRequestUseCase(repo).execute(VALID_INPUT)).rejects.toThrow(
      'fallo de BD',
    );
  });
});
