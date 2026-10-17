'use client';

import dynamic from 'next/dynamic';
import type { MapFilters } from '@/presentation/hooks/useMapFilters';

const MapInner = dynamic(() => import('./MapInner').then((m) => m.MapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="text-sm text-slate-300">Cargando mapa satelital…</p>
      </div>
    </div>
  ),
});

interface MapContainerClientProps {
  filters: MapFilters;
}

export function MapContainerClient({ filters }: MapContainerClientProps) {
  return (
    <div className="relative h-full w-full">
      <MapInner filters={filters} />
    </div>
  );
}