// Válido detrás de Vercel, que reescribe x-forwarded-for; revisar si cambia el hosting.
export function getClientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;

  return 'unknown';
}
