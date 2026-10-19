import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardCheck, LogOut, Users } from 'lucide-react';
import { getVerifier } from '@/infrastructure/auth/session';
import { SupabaseVerifierRepository } from '@/infrastructure/database/supabase-verifier.repository';
import { ManageVerifiersUseCase } from '@/application/use-cases/manage-verifiers.use-case';
import { signOut } from '../login/actions';
import { CreateVerifierForm } from './_components/CreateVerifierForm';
import { VerifierRow } from './_components/VerifierRow';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Administración de verificadores',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const actor = await getVerifier();
  if (!actor) redirect('/login');
  if (actor.role !== 'admin') redirect('/verify');

  const accounts = await new ManageVerifiersUseCase(new SupabaseVerifierRepository()).list(actor);
  const active = accounts.filter((a) => !a.disabledAt).length;

  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-slate-900 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500">
            <Users className="h-5 w-5 text-slate-900" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-tight">Equipo de verificación</h1>
            <p className="truncate text-xs text-slate-400">{actor.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/verify"
            className="flex items-center gap-1 rounded bg-slate-700 px-3 py-2 text-sm transition-colors hover:bg-slate-600"
          >
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Solicitudes</span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-1 rounded bg-slate-700 px-3 py-2 text-sm transition-colors hover:bg-slate-600"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:px-4">
        <CreateVerifierForm />

        <p className="text-sm text-slate-400">
          {accounts.length} cuenta{accounts.length === 1 ? '' : 's'} · {active} activa
          {active === 1 ? '' : 's'}
        </p>

        <ul className="space-y-3">
          {accounts.map((account) => (
            <VerifierRow
              key={account.userId}
              account={account}
              isSelf={account.userId === actor.userId}
            />
          ))}
        </ul>
      </section>
    </main>
  );
}
