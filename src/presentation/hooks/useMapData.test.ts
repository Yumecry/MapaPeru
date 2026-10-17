// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMapData } from './useMapData';
import type { MapFilters } from './useMapFilters';

const HOTSPOTS_PATH = '/api/cron/firms-sync';
const LOGISTICS_PATH = '/api/logistics/geojson';

const HOTSPOTS_BODY = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-72.1, -13.3] },
      properties: {
        id: 'NOAA-20-2026-10-15-0612-x',
        frp: 25,
        confidence: 'h',
        source: 'VIIRS_NOAA20_NRT',
        acquisitionDate: '2026-10-15T06:12:00Z',
        satellite: 'NOAA-20',
      },
    },
  ],
};

const LOGISTICS_BODY = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-70.1, -15.5] },
      properties: {
        id: 'req-1',
        createdAt: '2026-10-15T12:00:00.000Z',
        region: 'Puno',
        district: 'Juliaca',
        urgency: 'critico',
        categories: ['agua'],
        whatsAppLink: 'https://wa.me/51912345678?text=hola',
      },
    },
  ],
};

const BASE_FILTERS: MapFilters = { region: '', urgency: '', categories: [], minFrp: 0 };

type Route = (url: string) => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const okRoute: Route = (url) =>
  url.startsWith(HOTSPOTS_PATH) ? jsonResponse(HOTSPOTS_BODY) : jsonResponse(LOGISTICS_BODY);

function stubFetch(route: Route = okRoute) {
  const fetchMock = vi.fn<typeof fetch>(async (input) => route(String(input)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function calledUrls(fetchMock: ReturnType<typeof stubFetch>, path: string): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.startsWith(path));
}

describe('useMapData', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('carga ambas fuentes y expone las colecciones', async () => {
    stubFetch();
    const { result } = renderHook(() => useMapData(BASE_FILTERS));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hotspots.features).toHaveLength(1);
    expect(result.current.logistics.features).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('un error HTTP en focos solo rellena hotspotsError', async () => {
    stubFetch((url) =>
      url.startsWith(HOTSPOTS_PATH) ? jsonResponse({ error: 'x' }, 502) : jsonResponse(LOGISTICS_BODY),
    );
    const { result } = renderHook(() => useMapData(BASE_FILTERS));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hotspotsError).toBe('No se pudieron cargar los focos de calor (error 502)');
    expect(result.current.hotspots.features).toHaveLength(0);
    expect(result.current.logisticsError).toBeNull();
    expect(result.current.logistics.features).toHaveLength(1);
    expect(result.current.error).toBe(result.current.hotspotsError);
  });

  it('un error HTTP en logística solo rellena logisticsError', async () => {
    stubFetch((url) =>
      url.startsWith(LOGISTICS_PATH) ? jsonResponse({ error: 'x' }, 500) : jsonResponse(HOTSPOTS_BODY),
    );
    const { result } = renderHook(() => useMapData(BASE_FILTERS));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.logisticsError).toBe(
      'No se pudieron cargar las solicitudes logísticas (error 500)',
    );
    expect(result.current.hotspotsError).toBeNull();
    expect(result.current.hotspots.features).toHaveLength(1);
  });

  it('un cuerpo con forma inválida produce un error de formato', async () => {
    stubFetch((url) =>
      url.startsWith(HOTSPOTS_PATH)
        ? jsonResponse({ features: [{ type: 'Feature', geometry: null }] })
        : jsonResponse(LOGISTICS_BODY),
    );
    const { result } = renderHook(() => useMapData(BASE_FILTERS));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hotspotsError).toBe(
      'Formato de datos inesperado al cargar los focos de calor',
    );
    expect(result.current.logisticsError).toBeNull();
  });

  it('un cuerpo que no es JSON produce un error de respuesta inválida', async () => {
    stubFetch((url) =>
      url.startsWith(LOGISTICS_PATH) ? new Response('<html>', { status: 200 }) : jsonResponse(HOTSPOTS_BODY),
    );
    const { result } = renderHook(() => useMapData(BASE_FILTERS));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.logisticsError).toBe(
      'Respuesta inválida al cargar las solicitudes logísticas',
    );
  });

  it('cambiar urgency no vuelve a pedir los focos de calor', async () => {
    const fetchMock = stubFetch();
    const { result, rerender } = renderHook((filters: MapFilters) => useMapData(filters), {
      initialProps: BASE_FILTERS,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ ...BASE_FILTERS, urgency: 'critico' });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(calledUrls(fetchMock, HOTSPOTS_PATH)).toEqual([HOTSPOTS_PATH]);
    expect(calledUrls(fetchMock, LOGISTICS_PATH)).toEqual([
      LOGISTICS_PATH,
      `${LOGISTICS_PATH}?urgency=critico`,
    ]);
  });

  it('cambiar minFrp no vuelve a pedir la logística', async () => {
    const fetchMock = stubFetch();
    const { result, rerender } = renderHook((filters: MapFilters) => useMapData(filters), {
      initialProps: BASE_FILTERS,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ ...BASE_FILTERS, minFrp: 30 });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(calledUrls(fetchMock, LOGISTICS_PATH)).toEqual([LOGISTICS_PATH]);
    expect(calledUrls(fetchMock, HOTSPOTS_PATH)).toEqual([
      HOTSPOTS_PATH,
      `${HOTSPOTS_PATH}?min_frp=30`,
    ]);
  });

  it('marca loading mientras se resuelve la nueva URL y conserva los datos previos', async () => {
    let release: (() => void) | undefined;
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes('min_frp')) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return okRoute(url);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook((filters: MapFilters) => useMapData(filters), {
      initialProps: BASE_FILTERS,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ ...BASE_FILTERS, minFrp: 10 });
    expect(result.current.hotspotsLoading).toBe(true);
    expect(result.current.logisticsLoading).toBe(false);
    expect(result.current.hotspots.features).toHaveLength(1);

    await waitFor(() => expect(release).toBeDefined());
    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(result.current.hotspotsLoading).toBe(false));
  });

  it('aplica debounce de 350 ms a la región y no re-pide focos', async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch();
    const { rerender } = renderHook((filters: MapFilters) => useMapData(filters), {
      initialProps: BASE_FILTERS,
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    rerender({ ...BASE_FILTERS, region: 'Cu' });
    rerender({ ...BASE_FILTERS, region: 'Cusco' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(349);
    });
    expect(calledUrls(fetchMock, LOGISTICS_PATH)).toEqual([LOGISTICS_PATH]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(calledUrls(fetchMock, LOGISTICS_PATH)).toEqual([
      LOGISTICS_PATH,
      `${LOGISTICS_PATH}?region=Cusco`,
    ]);
    expect(calledUrls(fetchMock, HOTSPOTS_PATH)).toEqual([HOTSPOTS_PATH]);
  });
});
