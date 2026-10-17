'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Send, MapPin, Loader2 } from 'lucide-react';
import {
  logisticsRequestSchema,
  type LogisticsRequestInput,
} from '@/application/schemas/logistics-request.schema';

interface LogisticsRequestFormProps {
  onClose: () => void;
}

type GpsState = 'idle' | 'locating' | 'ready' | 'denied';

export function LogisticsRequestForm({ onClose }: LogisticsRequestFormProps) {
  const [gpsState, setGpsState] = useState<GpsState>('locating');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [whatsAppLink, setWhatsAppLink] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LogisticsRequestInput>({
    resolver: zodResolver(logisticsRequestSchema),
    defaultValues: { urgency: 'moderado', categories: [] },
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      // Detección única al montar: leer `navigator` durante el render rompería la hidratación.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGpsState('denied');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setValue('latitude', Number(pos.coords.latitude.toFixed(6)), {
          shouldValidate: true,
        });
        setValue('longitude', Number(pos.coords.longitude.toFixed(6)), {
          shouldValidate: true,
        });
        setGpsState('ready');
      },
      () => setGpsState('denied'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [setValue]);

  const onSubmit = async (data: LogisticsRequestInput) => {
    try {
      setSubmitError(null);
      const response = await fetch('/api/logistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error: { error?: string } = await response.json().catch(() => ({}));
        setSubmitError(error.error ?? 'No se pudo enviar la solicitud');
        return;
      }

      const result: { id?: string; whatsAppLink?: string } = await response
        .json()
        .catch(() => ({}));

      setSubmittedId(result.id ?? null);
      setWhatsAppLink(result.whatsAppLink ?? null);
    } catch {
      setSubmitError('Error de conexión. Intente nuevamente.');
    }
  };

  if (submittedId) {
    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <Send className="h-6 w-6 text-emerald-700" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Solicitud registrada</h2>
          <p className="mt-1 text-sm text-slate-600">
            Su reporte quedó pendiente de verificación por el equipo de respuesta.
          </p>
          <p className="mt-3 rounded bg-slate-100 px-3 py-2 font-mono text-xs break-all text-slate-700">
            ID: {submittedId}
          </p>
          {whatsAppLink && (
            <a
              href={whatsAppLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block w-full rounded bg-emerald-600 py-3 font-bold text-white"
            >
              Continuar por WhatsApp
            </a>
          )}
          <button
            onClick={onClose}
            className="mt-2 w-full rounded bg-slate-200 py-2 text-sm font-semibold text-slate-800"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-900">
            Solicitud de Ayuda
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Nombre completo
            </label>
            <input
              {...register('fullName')}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
            {errors.fullName && (
              <p className="text-xs text-red-600 mt-1">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Teléfono
            </label>
            <input
              {...register('phone')}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
            {errors.phone && (
              <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Región
              </label>
              <input
                {...register('region')}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
              {errors.region && (
                <p className="text-xs text-red-600 mt-1">{errors.region.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Distrito
              </label>
              <input
                {...register('district')}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
              {errors.district && (
                <p className="text-xs text-red-600 mt-1">{errors.district.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Urgencia
            </label>
            <select
              {...register('urgency')}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            >
              <option value="critico">Crítico</option>
              <option value="moderado">Moderado</option>
              <option value="cubierto">Cubierto</option>
            </select>
            {errors.urgency && (
              <p className="text-xs text-red-600 mt-1">{errors.urgency.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Insumos necesarios
            </label>
            <div className="flex flex-wrap gap-2">
              {(['agua', 'colirios', 'herramientas', 'veterinaria'] as const).map(
                (cat) => (
                  <label
                    key={cat}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-100 rounded-full text-xs cursor-pointer"
                  >
                    <input type="checkbox" value={cat} {...register('categories')} />
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </label>
                ),
              )}
            </div>
            {errors.categories && (
              <p className="text-xs text-red-600 mt-1">{errors.categories.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Descripción
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm resize-none"
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          {submitError && (
            <p className="rounded bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || gpsState !== 'ready'}
            className="flex w-full items-center justify-center gap-2 rounded bg-amber-500 py-3 font-bold text-slate-900 transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSubmitting ? 'Enviando…' : 'Enviar solicitud'}
          </button>

          <div className="flex items-start gap-1 text-xs text-slate-500">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            {gpsState === 'locating' && 'Obteniendo su ubicación GPS…'}
            {gpsState === 'ready' && 'Ubicación GPS adjunta al reporte.'}
            {gpsState === 'denied' && (
              <span className="text-red-600">
                Debe permitir el acceso a la ubicación para enviar el reporte.
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
