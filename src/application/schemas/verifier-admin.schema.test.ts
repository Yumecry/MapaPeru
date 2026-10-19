import { describe, expect, it } from 'vitest';
import { PASSWORD_MAX, PASSWORD_MIN, newVerifierSchema } from './verifier-admin.schema';

const VALID = { email: 'equipo@example.org', password: 'x'.repeat(PASSWORD_MIN), role: 'verificador' };

describe('newVerifierSchema', () => {
  it('acepta un alta válida y normaliza el correo', () => {
    const parsed = newVerifierSchema.parse({ ...VALID, email: '  Equipo@Example.ORG ' });
    expect(parsed.email).toBe('equipo@example.org');
  });

  it.each([
    ['contraseña corta', { password: 'x'.repeat(PASSWORD_MIN - 1) }],
    ['contraseña larga', { password: 'x'.repeat(PASSWORD_MAX + 1) }],
    ['correo inválido', { email: 'no-es-correo' }],
    ['rol desconocido', { role: 'root' }],
    ['rol ausente', { role: null }],
  ])('rechaza %s', (_label, override) => {
    expect(newVerifierSchema.safeParse({ ...VALID, ...override }).success).toBe(false);
  });

  it('acepta los límites exactos de longitud', () => {
    expect(newVerifierSchema.safeParse({ ...VALID, password: 'x'.repeat(PASSWORD_MAX) }).success).toBe(true);
  });
});
