import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';
import { getVerifier } from '@/infrastructure/auth/session';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Acceso de verificadores',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  let verifier = null;
  try {
    verifier = await getVerifier();
  } catch (error) {
    console.error('[login page]', error);
  }
  if (verifier) redirect('/verify');

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-sm rounded-lg bg-slate-900 p-6 shadow-2xl">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
            <LifeBuoy className="h-5 w-5 text-slate-900" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-white">Panel de verificación</h1>
            <p className="text-xs text-slate-400">Acceso solo para el equipo de respuesta</p>
          </div>
        </div>
        <LoginForm />
        <Link href="/" className="mt-6 block text-center text-xs text-slate-400 hover:text-amber-400">
          Volver al mapa
        </Link>
      </div>
    </main>
  );
}
