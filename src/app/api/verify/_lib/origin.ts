// Protección CSRF: el Origin del navegador debe coincidir con el host que sirve la app.
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  const host = (headers.get('x-forwarded-host') ?? headers.get('host'))?.split(',')[0]?.trim();
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
