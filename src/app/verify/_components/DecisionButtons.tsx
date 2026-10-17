'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Su sesión expiró. Vuelva a iniciar sesión.',
  403: 'No tiene permisos para esta acción.',
  404: 'La solicitud ya no existe.',
  409: 'Otra persona ya revisó esta solicitud.',
};

export function DecisionButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function send(body: { status: 'verificado' } | { status: 'rechazado'; reason: string }) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/verify/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok || res.status === 404 || res.status === 409) {
        if (!res.ok) setError(STATUS_MESSAGES[res.status]);
        router.refresh();
        return;
      }
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data: { error?: string } = await res.json().catch(() => ({}));
      setError(STATUS_MESSAGES[res.status] ?? data.error ?? 'No se pudo guardar la decisión.');
    } catch {
      setError('Error de conexión. Inténtelo de nuevo.');
    }
    setSending(false);
  }

  const trimmed = reason.trim();

  return (
    <div className="mt-4 border-t border-slate-800 pt-3">
      {rejecting ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed.length >= 3) void send({ status: 'rechazado', reason: trimmed });
          }}
          className="space-y-2"
        >
          <label htmlFor={`reason-${requestId}`} className="block text-sm text-slate-300">
            Motivo del rechazo
          </label>
          <textarea
            id={`reason-${requestId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={3}
            maxLength={300}
            rows={2}
            required
            disabled={sending}
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={sending || trimmed.length < 3}
              className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60 sm:flex-none"
            >
              {sending ? 'Enviando…' : 'Confirmar rechazo'}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
              className="flex-1 rounded bg-slate-700 px-3 py-2 text-sm transition-colors hover:bg-slate-600 disabled:opacity-60 sm:flex-none"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={sending}
            onClick={() => void send({ status: 'verificado' })}
            className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60 sm:flex-none"
          >
            <Check className="h-4 w-4" />
            {sending ? 'Enviando…' : 'Aprobar'}
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => setRejecting(true)}
            className="flex flex-1 items-center justify-center gap-1 rounded bg-slate-700 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-600 disabled:opacity-60 sm:flex-none"
          >
            <X className="h-4 w-4" />
            Rechazar
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
