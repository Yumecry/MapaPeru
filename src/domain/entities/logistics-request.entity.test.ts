import { describe, expect, it } from 'vitest';
import { InvalidStatusTransitionError, LogisticsRequest } from './logistics-request.entity';

const REQUESTER_PHONE = '+51 999 888 777';
const TEAM_PHONE = '+51 (912) 345-678';
const VERIFIER_ID = '7d1c2f0a-1b2c-4d3e-8f9a-0b1c2d3e4f5a';
const NOW = new Date('2026-10-16T15:30:00.000Z');

function buildRequest(): LogisticsRequest {
  return LogisticsRequest.create({
    contact: {
      fullName: 'María Quispe',
      phone: REQUESTER_PHONE,
      region: 'Cusco',
      district: 'Ollantaytambo',
    },
    latitude: -13.25,
    longitude: -72.26,
    categories: ['agua', 'colirios'],
    urgency: 'critico',
    description: 'Necesitamos agua potable para 30 familias',
  });
}

describe('LogisticsRequest.create', () => {
  it("deja status en 'pendiente' sin datos de verificación", () => {
    const request = buildRequest();
    expect(request.status).toBe('pendiente');
    expect(request.verifiedBy).toBeUndefined();
    expect(request.verifiedAt).toBeUndefined();
    expect(request.rejectionReason).toBeUndefined();
  });

  it('genera id UUID y fechas ISO iguales', () => {
    const request = buildRequest();
    expect(request.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(request.createdAt).toBe(request.updatedAt);
    expect(new Date(request.createdAt).toISOString()).toBe(request.createdAt);
  });

  it('es inmutable', () => {
    const request = buildRequest();
    expect(Object.isFrozen(request.contact)).toBe(true);
    expect(Object.isFrozen(request.categories)).toBe(true);
  });
});

describe('LogisticsRequest.toWhatsAppDeepLink', () => {
  it('apunta a https://wa.me/{dígitos del equipo}', () => {
    const link = buildRequest().toWhatsAppDeepLink(TEAM_PHONE);
    expect(link.startsWith('https://wa.me/51912345678?text=')).toBe(true);
  });

  it('nunca contiene el teléfono del solicitante', () => {
    const request = buildRequest();
    const link = request.toWhatsAppDeepLink(TEAM_PHONE);
    const decoded = decodeURIComponent(link);
    expect(decoded).not.toContain('999888777');
    expect(decoded).not.toContain('999 888 777');
    expect(link).not.toContain('999888777');
    expect(decoded).not.toContain(request.contact.fullName);
  });

  it('incluye el id de la solicitud en el mensaje', () => {
    const request = buildRequest();
    expect(decodeURIComponent(request.toWhatsAppDeepLink(TEAM_PHONE))).toContain(request.id);
  });

  it.each(['', '   ', '+-()'])('lanza si el teléfono del equipo no tiene dígitos (%j)', (phone) => {
    expect(() => buildRequest().toWhatsAppDeepLink(phone)).toThrow();
  });
});

describe('LogisticsRequest.verify', () => {
  it('devuelve una nueva instancia verificada sin mutar la original', () => {
    const original = buildRequest();
    const verified = original.verify(VERIFIER_ID, NOW);

    expect(verified).not.toBe(original);
    expect(original.status).toBe('pendiente');
    expect(verified.status).toBe('verificado');
    expect(verified.verifiedBy).toBe(VERIFIER_ID);
    expect(verified.verifiedAt).toBe(NOW.toISOString());
    expect(verified.updatedAt).toBe(NOW.toISOString());
    expect(verified.rejectionReason).toBeUndefined();
    expect(verified.id).toBe(original.id);
    expect(verified.createdAt).toBe(original.createdAt);
    expect(verified.contact).toEqual(original.contact);
    expect(Object.isFrozen(verified.contact)).toBe(true);
  });

  it.each(['verify', 'reject'] as const)('no permite %s una solicitud ya verificada', (action) => {
    const verified = buildRequest().verify(VERIFIER_ID, NOW);
    const run = () =>
      action === 'verify'
        ? verified.verify(VERIFIER_ID, NOW)
        : verified.reject(VERIFIER_ID, 'Duplicada', NOW);
    expect(run).toThrow(InvalidStatusTransitionError);
  });

  it('exige un identificador de verificador', () => {
    expect(() => buildRequest().verify('  ', NOW)).toThrow();
  });
});

describe('LogisticsRequest.reject', () => {
  it('devuelve una nueva instancia rechazada con motivo recortado', () => {
    const original = buildRequest();
    const rejected = original.reject(VERIFIER_ID, '  No se pudo contactar  ', NOW);

    expect(original.status).toBe('pendiente');
    expect(rejected.status).toBe('rechazado');
    expect(rejected.rejectionReason).toBe('No se pudo contactar');
    expect(rejected.verifiedBy).toBe(VERIFIER_ID);
    expect(rejected.verifiedAt).toBe(NOW.toISOString());
  });

  it('exige un motivo no vacío', () => {
    expect(() => buildRequest().reject(VERIFIER_ID, '   ', NOW)).toThrow();
  });

  it.each(['verify', 'reject'] as const)('no permite %s una solicitud ya rechazada', (action) => {
    const rejected = buildRequest().reject(VERIFIER_ID, 'Falsa', NOW);
    const run = () =>
      action === 'verify'
        ? rejected.verify(VERIFIER_ID, NOW)
        : rejected.reject(VERIFIER_ID, 'Otra vez', NOW);
    expect(run).toThrow(InvalidStatusTransitionError);
  });

  it('el error indica los estados de la transición', () => {
    const rejected = buildRequest().reject(VERIFIER_ID, 'Falsa', NOW);
    try {
      rejected.verify(VERIFIER_ID, NOW);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidStatusTransitionError);
      expect(error).toMatchObject({ from: 'rechazado', to: 'verificado' });
    }
  });
});
