'use client';

import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { supplyCategorySchema } from '@/application/schemas/logistics-request.schema';
import type {
  HotspotFeatureCollection,
  LogisticsFeatureCollection,
} from '@/presentation/types';
import type { MapFilters } from './useMapFilters';

const HOTSPOT_FEATURE_SCHEMA = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    id: z.string(),
    frp: z.number(),
    confidence: z.enum(['n', 'h']),
    source: z.enum(['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT']),
    acquisitionDate: z.string(),
    satellite: z.enum(['NOAA-20', 'NOAA-21']),
  }),
});

const LOGISTICS_FEATURE_SCHEMA = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number(), z.number()]),
  }),
  properties: z.object({
    id: z.string(),
    createdAt: z.string(),
    region: z.string(),
    district: z.string(),
    urgency: z.enum(['critico', 'moderado', 'cubierto']),
    categories: z.array(supplyCategorySchema),
    whatsAppLink: z.string(),
  }),
});

export interface MapDataState {
  hotspots: HotspotFeatureCollection;
  logistics: LogisticsFeatureCollection;
  loading: boolean;
  hotspotsLoading: boolean;
  logisticsLoading: boolean;
  hotspotsError: string | null;
  logisticsError: string | null;
  error: string | null;
}

const EMPTY_HOTSPOTS: HotspotFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const EMPTY_LOGISTICS: LogisticsFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

const HOTSPOTS_RESPONSE_SCHEMA = z.object({
  features: z.array(HOTSPOT_FEATURE_SCHEMA),
});

const LOGISTICS_RESPONSE_SCHEMA = z.object({
  features: z.array(LOGISTICS_FEATURE_SCHEMA),
});

interface ResourceState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

interface SettledResource<T> {
  url: string | null;
  data: T;
  error: string | null;
}

function buildHotspotsUrl(minFrp: number): string {
  const params = new URLSearchParams();
  if (minFrp > 0) params.set('min_frp', String(minFrp));
  const qs = params.toString();
  return qs ? `/api/hotspots?${qs}` : '/api/hotspots';
}

function buildLogisticsUrl(
  region: string,
  urgency: string,
  categoriesKey: string,
): string {
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (urgency) params.set('urgency', urgency);
  if (categoriesKey) params.set('categories', categoriesKey);
  const qs = params.toString();
  return qs ? `/api/logistics/geojson?${qs}` : '/api/logistics/geojson';
}

class FetchJsonError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'FetchJsonError';
  }
}

async function readJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) {
    throw new FetchJsonError(`HTTP ${res.status}`, res.status);
  }
  try {
    return await res.json();
  } catch {
    throw new FetchJsonError('Respuesta no es JSON', res.status);
  }
}

function describeError(resource: string, err: unknown): string {
  if (err instanceof FetchJsonError && err.status !== null && err.status >= 400) {
    return `No se pudieron cargar ${resource} (error ${err.status})`;
  }
  if (err instanceof FetchJsonError) {
    return `Respuesta inválida al cargar ${resource}`;
  }
  return `No se pudieron cargar ${resource}`;
}

function useJsonResource<T, F>(
  url: string,
  schema: z.ZodType<{ features: F[] }>,
  empty: T,
  toData: (features: F[]) => T,
  resource: string,
): ResourceState<T> {
  // `loading` se deriva comparando la URL pedida con la última resuelta, en vez de
  // marcarlo con setState síncrono dentro del efecto (react-hooks/set-state-in-effect).
  // Mientras carga se conservan los datos y el error anteriores.
  const [settled, setSettled] = useState<SettledResource<T>>({
    url: null,
    data: empty,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    readJson(url, controller.signal)
      .then((body) => {
        if (controller.signal.aborted) return;
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          setSettled({
            url,
            data: empty,
            error: `Formato de datos inesperado al cargar ${resource}`,
          });
          return;
        }
        setSettled({
          url,
          data: toData(parsed.data.features),
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setSettled({
          url,
          data: empty,
          error: describeError(resource, err),
        });
      });

    return () => {
      controller.abort();
    };
  }, [url, schema, empty, toData, resource]);

  return {
    data: settled.data,
    loading: settled.url !== url,
    error: settled.error,
  };
}

function toHotspots(
  features: HotspotFeatureCollection['features'],
): HotspotFeatureCollection {
  return { type: 'FeatureCollection', features };
}

function toLogistics(
  features: LogisticsFeatureCollection['features'],
): LogisticsFeatureCollection {
  return { type: 'FeatureCollection', features };
}

export function useMapData(filters: MapFilters): MapDataState {
  const [debouncedRegion, setDebouncedRegion] = useState(filters.region);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRegion(filters.region), 350);
    return () => clearTimeout(timer);
  }, [filters.region]);

  const categoriesKey = filters.categories.join(',');

  const hotspotsUrl = useMemo(
    () => buildHotspotsUrl(filters.minFrp),
    [filters.minFrp],
  );

  const logisticsUrl = useMemo(
    () => buildLogisticsUrl(debouncedRegion, filters.urgency, categoriesKey),
    [debouncedRegion, filters.urgency, categoriesKey],
  );

  const hotspots = useJsonResource(
    hotspotsUrl,
    HOTSPOTS_RESPONSE_SCHEMA,
    EMPTY_HOTSPOTS,
    toHotspots,
    'los focos de calor',
  );

  const logistics = useJsonResource(
    logisticsUrl,
    LOGISTICS_RESPONSE_SCHEMA,
    EMPTY_LOGISTICS,
    toLogistics,
    'las solicitudes logísticas',
  );

  const errors = [hotspots.error, logistics.error].filter(
    (e): e is string => e !== null,
  );

  return {
    hotspots: hotspots.data,
    logistics: logistics.data,
    loading: hotspots.loading || logistics.loading,
    hotspotsLoading: hotspots.loading,
    logisticsLoading: logistics.loading,
    hotspotsError: hotspots.error,
    logisticsError: logistics.error,
    error: errors.length > 0 ? errors.join(' · ') : null,
  };
}
