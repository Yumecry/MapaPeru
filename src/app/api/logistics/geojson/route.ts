import { NextRequest, NextResponse } from 'next/server';
import { PostgisLogisticsRepository } from '@/infrastructure/database/postgis-logistics.repository';
import { getResponseTeamWhatsApp } from '@/infrastructure/config/response-team';
import { GetVerifiedRequestsUseCase } from '@/application/use-cases/get-verified-requests.use-case';
import { logisticsToGeoJSON } from '@/application/mappers/logistics-geojson.mapper';
import { parseVerifiedFilters } from '../_lib/filters';
import { badRequest, serverError } from '../_lib/responses';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 's-maxage=3600, stale-while-revalidate';

export async function GET(request: NextRequest) {
  const parsed = parseVerifiedFilters(request.nextUrl.searchParams);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const teamPhone = getResponseTeamWhatsApp();
    const useCase = new GetVerifiedRequestsUseCase(new PostgisLogisticsRepository());
    const requests = await useCase.execute(parsed.filters);

    return NextResponse.json(logisticsToGeoJSON(requests, teamPhone), {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  } catch (error) {
    return serverError('GET /api/logistics/geojson', error, 502);
  }
}
