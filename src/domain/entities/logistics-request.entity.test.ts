import { describe, expect, it } from 'vitest';
import { LogisticsRequest } from './logistics-request.entity';

const REQUESTER_PHONE = '+51 999 888 777';
const TEAM_PHONE = '+51 (912) 345-678';

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
  it("deja isVerified en 'pendiente'", () => {
    expect(buildRequest().isVerified).toBe('pendiente');
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
