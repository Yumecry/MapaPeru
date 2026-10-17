'use client';

import { useState } from 'react';
import { Filter, LifeBuoy } from 'lucide-react';
import dynamic from 'next/dynamic';
import { FilterSidebar } from '@/presentation/components/ui/FilterSidebar';
import { LogisticsRequestForm } from '@/presentation/components/forms/LogisticsRequestForm';
import { useMapFilters } from '@/presentation/hooks/useMapFilters';

const MapContainerClient = dynamic(
  () =>
    import('@/presentation/components/map/MapContainerClient').then(
      (m) => m.MapContainerClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white">
        <div className="space-y-3 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-slate-300">Inicializando mapa…</p>
        </div>
      </div>
    ),
  },
);

export default function Home() {
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { filters, setRegion, setUrgency, toggleCategory, setMinFrp, resetFilters } =
    useMapFilters();

  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden bg-slate-950">
      <header className="flex shrink-0 items-center justify-between bg-slate-900 px-3 py-2 text-white sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
            <LifeBuoy className="h-5 w-5 text-slate-900" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">Respuesta Humanitaria</h1>
            <p className="text-xs text-slate-400">Monitoreo satelital — Perú</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-pressed={showFilters}
            aria-label="Alternar filtros"
            className={`rounded p-2 transition-colors ${
              showFilters
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
          >
            <Filter className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="rounded bg-amber-500 px-3 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-600"
          >
            Solicitar ayuda
          </button>
        </div>
      </header>

      <div className="relative flex-1">
        <MapContainerClient filters={filters} />

        {showFilters && (
          <div className="absolute inset-y-0 left-0 z-[1000] w-72 max-w-[85vw] shadow-2xl">
            <FilterSidebar
              filters={filters}
              onRegionChange={setRegion}
              onUrgencyChange={setUrgency}
              onToggleCategory={toggleCategory}
              onMinFrpChange={setMinFrp}
              onReset={resetFilters}
              onClose={() => setShowFilters(false)}
            />
          </div>
        )}

        {showForm && <LogisticsRequestForm onClose={() => setShowForm(false)} />}
      </div>
    </main>
  );
}