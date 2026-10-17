import { NextResponse } from 'next/server';

export const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE });
}

export function serverError(context: string, error: unknown, status = 500): NextResponse {
  console.error(`[${context}]`, error);
  return NextResponse.json(
    { error: 'Ocurrió un error interno. Inténtelo de nuevo más tarde.' },
    { status, headers: NO_STORE },
  );
}
