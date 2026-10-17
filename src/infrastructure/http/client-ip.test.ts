import { describe, expect, it } from 'vitest';
import { getClientIp } from './client-ip';

describe('getClientIp', () => {
  it('prioriza x-real-ip', () => {
    const headers = new Headers({ 'x-real-ip': ' 203.0.113.7 ', 'x-forwarded-for': '198.51.100.1' });
    expect(getClientIp(headers)).toBe('203.0.113.7');
  });

  it('usa la primera IP de x-forwarded-for', () => {
    const headers = new Headers({ 'x-forwarded-for': ' 198.51.100.1 , 10.0.0.1, 10.0.0.2' });
    expect(getClientIp(headers)).toBe('198.51.100.1');
  });

  it('ignora x-real-ip vacío', () => {
    const headers = new Headers({ 'x-real-ip': '   ', 'x-forwarded-for': '198.51.100.1' });
    expect(getClientIp(headers)).toBe('198.51.100.1');
  });

  it("devuelve 'unknown' sin cabeceras útiles", () => {
    expect(getClientIp(new Headers())).toBe('unknown');
    expect(getClientIp(new Headers({ 'x-forwarded-for': ' , 10.0.0.1' }))).toBe('unknown');
  });

  it('acepta IPv6', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1');
  });
});
