'use client';

import { Filter, X } from 'lucide-react';
import type { MapFilters } from '@/presentation/hooks/useMapFilters';
import type { SupplyCategory, UrgencyLevel } from '@/domain/types';

interface FilterSidebarProps {
  filters: MapFilters;
  onRegionChange: (value: string) => void;
  onUrgencyChange: (value: UrgencyLevel | '') => void;
  onToggleCategory: (category: SupplyCategory) => void;
  onMinFrpChange: (value: number) => void;
  onReset: () => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<SupplyCategory, string> = {
  agua: 'Agua',
  colirios: 'Colirios',
  herramientas: 'Herramientas',
  veterinaria: 'Veterinaria',
};

const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  critico: 'Crítico',
  moderado: 'Moderado',
  cubierto: 'Cubierto',
};

export function FilterSidebar({
  filters,
  onRegionChange,
  onUrgencyChange,
  onToggleCategory,
  onMinFrpChange,
  onReset,
  onClose,
}: FilterSidebarProps) {
  return (
    <div className="bg-slate-900 text-white p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-amber-400" />
          <h2 className="font-bold text-lg">Filtros</h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar filtros"
          className="p-1 hover:bg-slate-700 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-300">
            Región
          </label>
          <input
            type="text"
            value={filters.region}
            onChange={(e) => onRegionChange(e.target.value)}
            placeholder="Ej: Loreto"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-400"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-300">
            Urgencia
          </label>
          <select
            value={filters.urgency}
            onChange={(e) => onUrgencyChange(e.target.value as UrgencyLevel | '')}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white"
          >
            <option value="">Todas</option>
            {Object.entries(URGENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-300">
            Insumos
          </label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CATEGORY_LABELS) as SupplyCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  filters.categories.includes(cat)
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1 text-slate-300">
            FRP mínimo: {filters.minFrp} MW
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.minFrp}
            onChange={(e) => onMinFrpChange(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>

        <button
          onClick={onReset}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-semibold transition-colors"
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}
