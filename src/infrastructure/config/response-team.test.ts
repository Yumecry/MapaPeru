import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadGetter() {
  const mod = await import('./response-team');
  return mod.getResponseTeamWhatsApp;
}

describe('getResponseTeamWhatsApp', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('devuelve solo los dígitos', async () => {
    vi.stubEnv('RESPONSE_TEAM_WHATSAPP', '+51 (987) 654-321');
    const get = await loadGetter();
    expect(get()).toBe('51987654321');
  });

  it('lanza si la variable falta', async () => {
    vi.stubEnv('RESPONSE_TEAM_WHATSAPP', undefined);
    const get = await loadGetter();
    expect(() => get()).toThrow(/RESPONSE_TEAM_WHATSAPP es requerido/);
  });

  it('lanza si la variable está vacía o solo tiene espacios', async () => {
    vi.stubEnv('RESPONSE_TEAM_WHATSAPP', '   ');
    const get = await loadGetter();
    expect(() => get()).toThrow(/RESPONSE_TEAM_WHATSAPP es requerido/);
  });

  it.each([
    ['menos de 9 dígitos', '12345678'],
    ['más de 15 dígitos', '1234567890123456'],
    ['sin dígitos', 'abc-def'],
  ])('lanza con %s', async (_label, value) => {
    vi.stubEnv('RESPONSE_TEAM_WHATSAPP', value);
    const get = await loadGetter();
    expect(() => get()).toThrow(/entre 9 y 15 dígitos/);
  });

  it.each(['123456789', '123456789012345'])('acepta los límites (%s)', async (value) => {
    vi.stubEnv('RESPONSE_TEAM_WHATSAPP', value);
    const get = await loadGetter();
    expect(get()).toBe(value);
  });

  it('cachea el primer valor válido', async () => {
    vi.stubEnv('RESPONSE_TEAM_WHATSAPP', '51987654321');
    const get = await loadGetter();
    expect(get()).toBe('51987654321');

    vi.stubEnv('RESPONSE_TEAM_WHATSAPP', '51900000000');
    expect(get()).toBe('51987654321');
  });

  it('no cachea un valor inválido', async () => {
    vi.stubEnv('RESPONSE_TEAM_WHATSAPP', '123');
    const get = await loadGetter();
    expect(() => get()).toThrow();

    vi.stubEnv('RESPONSE_TEAM_WHATSAPP', '51987654321');
    expect(get()).toBe('51987654321');
  });
});
