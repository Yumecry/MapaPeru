'use client';

import { useState, useCallback } from 'react';
import type { UrgencyLevel, SupplyCategory } from '@/domain/types';

export interface MapFilters {
  region: string;
  urgency: UrgencyLevel | '';
  categories: SupplyCategory[];
  minFrp: number;
}

const DEFAULT_FILTERS: MapFilters = {
  region: '',
  urgency: '',
  categories: [],
  minFrp: 0,
};

export function useMapFilters() {
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);

  const setRegion = useCallback((region: string) => {
    setFilters((prev) => ({ ...prev, region }));
  }, []);

  const setUrgency = useCallback((urgency: UrgencyLevel | '') => {
    setFilters((prev) => ({ ...prev, urgency }));
  }, []);

  const toggleCategory = useCallback((category: SupplyCategory) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  }, []);

  const setMinFrp = useCallback((minFrp: number) => {
    setFilters((prev) => ({ ...prev, minFrp }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    filters,
    setRegion,
    setUrgency,
    toggleCategory,
    setMinFrp,
    resetFilters,
  };
}
