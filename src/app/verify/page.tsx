import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LifeBuoy, LogOut, MapPin } from 'lucide-react';
import { getVerifier } from '@/infrastructure/auth/session';
import { PostgisLogisticsRepository } from '@/infrastructure/database/postgis-logistics.repository';
import { GetPendingRequestsUseCase } from '@/application/use-cases/get-pending-requests.use-case';
import type { LogisticsRequest } from '@/domain/entities/logistics-request.entity';
import type { SupplyCategory, UrgencyLevel } from '@/domain/types';
import { signOut } from '../login/actions';
import { DecisionButtons } from './_components/DecisionButtons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Verificación de solicitudes',
  robots: { index: false, follow: false },
};

const URGENCY_STYLES: Record<UrgencyLevel, { label: string; className: string }> = {
  critico: { label: 'Crítico', className: 'bg-red-600 text-white' },
  moderado: { label: 'Moderado', className: 'bg-amber-500 text-slate-900' },
  cubierto: { label: 'Cubierto', className: 'bg-emerald-600 text-white' },
};

const CATEGORY_LABELS: Record<SupplyCategory, string> = {
  agua: 'Agua',
  colirios: 'Colirios',
  herramientas: 'Herramientas',
  veterinaria: 'Veterinaria',
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Lima',
});

function osmUrl(request: LogisticsRequest): string {
  const lat = request.latitude.toFixed(5);
  const lng = request.longitude.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export default async function VerifyPage() {
  const verifier = await getVerifier();
  if (!verifier) redirect('/login');

  const pending = await new GetPendingRequestsUseCase(new PostgisLogisticsRepository()).execute();

  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-slate-900 px-3 py-2 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500">
            <LifeBuoy className="h-5 w-5 text-slate-900" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold leading-tight">Verificación de solicitudes</h1>
            <p className="truncate text-xs text-slate-400">{verifier.email}</p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1 rounded bg-slate-700 px-3 py-2 text-sm transition-colors hover:bg-slate-600"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </form>
      </header>

      <section className="mx-auto max-w-3xl space-y-3 px-3 py-4 sm:px-4">
        <p className="text-sm text-slate-400">
          {pending.length === 0
            ? 'No hay solicitudes pendientes.'
            : `${pending.length} solicitud${pending.length === 1 ? '' : 'es'} pendiente${pending.length === 1 ? '' : 's'} (más antiguas primero).`}
        </p>

        {pending.map((request) => {
          const urgency = URGENCY_STYLES[request.urgency];
          return (
            <article key={request.id} className="rounded-lg bg-slate-900 p-4 shadow">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold break-words">{request.contact.fullName}</h2>
                  <a
                    href={telHref(request.contact.phone)}
                    className="text-sm text-amber-400 hover:underline"
                  >
                    {request.contact.phone}
                  </a>
                </div>
                <span className={`rounded px-2 py-1 text-xs font-bold ${urgency.className}`}>
                  {urgency.label}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="inline text-slate-400">Región / distrito: </dt>
                  <dd className="inline">
                    {request.contact.region} / {request.contact.district}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-slate-400">Recibida: </dt>
                  <dd className="inline">{DATE_FORMAT.format(new Date(request.createdAt))}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline text-slate-400">Necesita: </dt>
                  <dd className="inline">
                    {request.categories.map((c) => CATEGORY_LABELS[c]).join(', ')}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 rounded bg-slate-800 p-3 text-sm whitespace-pre-wrap break-words text-slate-200">
                {request.description}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <a
                  href={osmUrl(request)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-amber-400 hover:underline"
                >
                  <MapPin className="h-4 w-4" />
                  Ver ubicación ({request.latitude.toFixed(4)}, {request.longitude.toFixed(4)})
                </a>
                <span className="font-mono text-xs text-slate-500">{request.id}</span>
              </div>

              <DecisionButtons requestId={request.id} />
            </article>
          );
        })}
      </section>
    </main>
  );
}
