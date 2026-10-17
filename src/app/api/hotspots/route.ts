import { NextRequest, NextResponse } from 'next/server';
import { PostgisHotspotRepository } from '@/infrastructure/database/postgis-hotspot.repository';
import { GetActiveHotspotsUseCase } from '@/application/use-cases/get-active-hotspots.use-case';
import { hotspotToGeoJSON } from '@/application/mappers/hotspot-geojson.mapper';
import { badRequest, serverError } from '../logistics/_lib/responses';
import { parseHotspotParams } from './_lib/params';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 's-maxage=900, stale-while-revalidate';

export async function GET(request: NextRequest) {
  const parsed = parseHotspotParams(request.nextUrl.searchParams);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const useCase = new GetActiveHotspotsUseCase(new PostgisHotspotRepository());
    const hotspots = await useCase.execute(parsed.input);

    return NextResponse.json(hotspotToGeoJSON(hotspots), {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  } catch (error) {
    return serverError('GET /api/hotspots', error, 502);
  }
}
