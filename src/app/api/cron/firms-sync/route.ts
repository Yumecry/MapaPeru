import { NextRequest, NextResponse } from 'next/server';
import { NasaFirmsAdapter } from '@/infrastructure/adapters/nasa-firms.adapter';
import { PostgisHotspotRepository } from '@/infrastructure/database/postgis-hotspot.repository';
import { SyncHotspotsUseCase } from '@/application/use-cases/sync-hotspots.use-case';
import { checkCronAuth } from '../../_lib/cron-auth';
import { NO_STORE, serverError } from '../../logistics/_lib/responses';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// FIRMS NRT llega con ~3 h de latencia: 2 días evita perder focos tardíos del día UTC anterior.
const SYNC_DAY_RANGE = 2;

export async function GET(request: NextRequest) {
  const auth = checkCronAuth(request.headers.get('authorization'));
  if (auth === 'misconfigured') {
    return serverError('GET /api/cron/firms-sync', new Error('CRON_SECRET no configurado'));
  }
  if (auth === 'unauthorized') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: NO_STORE });
  }

  try {
    const useCase = new SyncHotspotsUseCase(
      new NasaFirmsAdapter({ dayRange: SYNC_DAY_RANGE }),
      new PostgisHotspotRepository(),
    );
    const result = await useCase.execute();
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    return serverError('GET /api/cron/firms-sync', error);
  }
}
