import { NextRequest, NextResponse } from 'next/server';
import { NasaFirmsAdapter } from '@/infrastructure/adapters/nasa-firms.adapter';
import { GetActiveHotspotsUseCase } from '@/application/use-cases/get-active-hotspots.use-case';
import { hotspotToGeoJSON } from '@/application/mappers/hotspot-geojson.mapper';
import type { HotspotQueryFilters } from '@/domain/repositories/hotspot.repository';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 's-maxage=3600, stale-while-revalidate';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const minFrpParam = searchParams.get('min_frp');
    const dateFromParam = searchParams.get('date_from');
    const dateToParam = searchParams.get('date_to');

    const filters: HotspotQueryFilters = {};

    if (minFrpParam !== null) {
      const minFrp = Number(minFrpParam);
      if (!Number.isFinite(minFrp) || minFrp < 0) {
        return NextResponse.json(
          { error: 'min_frp debe ser un número no negativo' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      filters.minFrp = minFrp;
    }

    if (dateFromParam !== null) {
      if (!DATE_PATTERN.test(dateFromParam)) {
        return NextResponse.json(
          { error: 'date_from debe tener formato YYYY-MM-DD' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      filters.dateFrom = `${dateFromParam}T00:00:00Z`;
    }

    if (dateToParam !== null) {
      if (!DATE_PATTERN.test(dateToParam)) {
        return NextResponse.json(
          { error: 'date_to debe tener formato YYYY-MM-DD' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      filters.dateTo = `${dateToParam}T23:59:59Z`;
    }

    const adapter = new NasaFirmsAdapter();
    const useCase = new GetActiveHotspotsUseCase(adapter);
    const hotspots = await useCase.execute(filters);

    return NextResponse.json(hotspotToGeoJSON(hotspots), {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  } catch (error) {
    console.error('GET /api/cron/firms-sync', error);
    return NextResponse.json(
      { error: 'No se pudieron obtener los focos de calor. Inténtelo de nuevo más tarde.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}