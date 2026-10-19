import { describe, expect, it } from 'vitest';
import { generatePassword } from './password';

describe('generatePassword', () => {
  it('genera 16 caracteres sin ambiguos por defecto', () => {
    const password = generatePassword();
    expect(password).toHaveLength(16);
    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
  });

  it('descarta los bytes que introducirían sesgo', () => {
    // 57 símbolos → se rechazan los bytes >= 228 (256 - 256 % 57).
    let call = 0;
    const random = (bytes: Uint8Array) => {
      bytes.fill(call++ === 0 ? 255 : 0);
      return bytes;
    };
    expect(generatePassword(4, random)).toBe('AAAA');
  });

  it('respeta la longitud pedida', () => {
    expect(generatePassword(30)).toHaveLength(30);
  });
});
