import { describe, expect, it } from 'vitest';
import { logisticsRequestSchema } from './logistics-request.schema';

const VALID_INPUT = {
  fullName: 'Rosa Huamán',
  phone: '+51 987-654-321',
  region: 'Cusco',
  district: 'Urubamba',
  latitude: -13.3,
  longitude: -72.1,
  categories: ['agua'],
  urgency: 'critico',
  description: 'Faltan bidones de agua en la comunidad',
};

function parse(overrides: Record<string, unknown>) {
  return logisticsRequestSchema.safeParse({ ...VALID_INPUT, ...overrides });
}

function failedFields(overrides: Record<string, unknown>): string[] {
  const result = parse(overrides);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
}

describe('logisticsRequestSchema', () => {
  it('acepta una entrada válida', () => {
    expect(parse({}).success).toBe(true);
  });

  describe('fullName', () => {
    it('acepta 3 y 80 caracteres', () => {
      expect(parse({ fullName: 'Ana' }).success).toBe(true);
      expect(parse({ fullName: 'a'.repeat(80) }).success).toBe(true);
    });

    it('rechaza 2 y 81 caracteres', () => {
      expect(failedFields({ fullName: 'Al' })).toEqual(['fullName']);
      expect(failedFields({ fullName: 'a'.repeat(81) })).toEqual(['fullName']);
    });

    it('recorta espacios antes de medir', () => {
      expect(parse({ fullName: '  Al  ' }).success).toBe(false);
      const ok = parse({ fullName: '  Ana  ' });
      expect(ok.success && ok.data.fullName).toBe('Ana');
    });

    it('rechaza dígitos y símbolos', () => {
      expect(failedFields({ fullName: 'Ana 123' })).toEqual(['fullName']);
      expect(failedFields({ fullName: '<script>' })).toEqual(['fullName']);
    });
  });

  describe('phone', () => {
    it('acepta 8 y 15 caracteres con +, espacios y guiones', () => {
      expect(parse({ phone: '98765432' }).success).toBe(true);
      expect(parse({ phone: '+51 987 654 321' }).success).toBe(true);
    });

    it('rechaza menos de 8 o más de 15 caracteres', () => {
      expect(failedFields({ phone: '9876543' })).toEqual(['phone']);
      expect(failedFields({ phone: '1234567890123456' })).toContain('phone');
    });

    it('rechaza letras y + intermedio', () => {
      expect(failedFields({ phone: '98765abc' })).toEqual(['phone']);
      expect(failedFields({ phone: '987+654321' })).toEqual(['phone']);
    });
  });

  describe('categories', () => {
    it('exige entre 1 y 4 categorías', () => {
      expect(failedFields({ categories: [] })).toEqual(['categories']);
      expect(parse({ categories: ['agua', 'colirios', 'herramientas', 'veterinaria'] }).success).toBe(
        true,
      );
      expect(
        failedFields({ categories: ['agua', 'colirios', 'herramientas', 'veterinaria', 'agua'] }),
      ).toEqual(['categories']);
    });

    it('rechaza categorías desconocidas', () => {
      expect(failedFields({ categories: ['comida'] })).toEqual(['categories.0']);
    });
  });

  describe('description', () => {
    it('acepta 10 y 500 caracteres', () => {
      expect(parse({ description: 'a'.repeat(10) }).success).toBe(true);
      expect(parse({ description: 'a'.repeat(500) }).success).toBe(true);
    });

    it('rechaza 9 y 501 caracteres', () => {
      expect(failedFields({ description: 'a'.repeat(9) })).toEqual(['description']);
      expect(failedFields({ description: 'a'.repeat(501) })).toEqual(['description']);
    });
  });

  describe('latitude / longitude', () => {
    it('acepta los extremos', () => {
      expect(parse({ latitude: -90, longitude: -180 }).success).toBe(true);
      expect(parse({ latitude: 90, longitude: 180 }).success).toBe(true);
    });

    it('rechaza valores fuera de rango', () => {
      expect(failedFields({ latitude: 90.01 })).toEqual(['latitude']);
      expect(failedFields({ latitude: -90.01 })).toEqual(['latitude']);
      expect(failedFields({ longitude: 180.01 })).toEqual(['longitude']);
      expect(failedFields({ longitude: -180.01 })).toEqual(['longitude']);
    });

    it('exige números (sin GPS no hay envío)', () => {
      expect(failedFields({ latitude: undefined })).toEqual(['latitude']);
      expect(failedFields({ longitude: '-72.1' })).toEqual(['longitude']);
    });
  });

  it('rechaza urgencias desconocidas', () => {
    expect(failedFields({ urgency: 'alta' })).toEqual(['urgency']);
  });

  it('descarta campos no declarados como isVerified', () => {
    const result = parse({ isVerified: 'verificado', is_verified: true });
    expect(result.success).toBe(true);
    expect(result.success && result.data).not.toHaveProperty('isVerified');
    expect(result.success && result.data).not.toHaveProperty('is_verified');
  });
});
