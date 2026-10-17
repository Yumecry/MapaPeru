import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PostgisLogisticsRepository } from '@/infrastructure/database/postgis-logistics.repository';
import { SupabaseRateLimiter } from '@/infrastructure/database/rate-limiter.repository';
import { getResponseTeamWhatsApp } from '@/infrastructure/config/response-team';
import { getClientIp } from '@/infrastructure/http/client-ip';
import { GetVerifiedRequestsUseCase } from '@/application/use-cases/get-verified-requests.use-case';
import { SubmitLogisticsRequestUseCase } from '@/application/use-cases/submit-logistics-request.use-case';
import { toPublicLogisticsView } from '@/application/mappers/public-logistics-view.mapper';
import { parseVerifiedFilters } from './_lib/filters';
import { NO_STORE, badRequest, serverError } from './_lib/responses';

export const dynamic = 'force-dynamic';

const CACHE_CONTROL = 's-maxage=3600, stale-while-revalidate';
const SUBMIT_LIMIT = 5;
const SUBMIT_WINDOW_SECONDS = 60 * 60;

export async function GET(request: NextRequest) {
  const parsed = parseVerifiedFilters(request.nextUrl.searchParams);
  if (!parsed.ok) return badRequest(parsed.error);

  try {
    const teamPhone = getResponseTeamWhatsApp();
    const useCase = new GetVerifiedRequestsUseCase(new PostgisLogisticsRepository());
    const requests = await useCase.execute(parsed.filters);
    const views = requests.map((r) => toPublicLogisticsView(r, teamPhone));

    return NextResponse.json(
      { count: views.length, requests: views },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    );
  } catch (error) {
    return serverError('GET /api/logistics', error, 502);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('El cuerpo de la solicitud no es un JSON válido');
  }

  try {
    const teamPhone = getResponseTeamWhatsApp();

    const ip = getClientIp(request.headers);
    const limit = await new SupabaseRateLimiter().consume(
      `submit:${ip}`,
      SUBMIT_LIMIT,
      SUBMIT_WINDOW_SECONDS,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: 'Ha superado el límite de envíos. Inténtelo de nuevo más tarde.',
          retryAfter: limit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    }

    const useCase = new SubmitLogisticsRequestUseCase(new PostgisLogisticsRepository());
    const created = await useCase.execute(body);

    return NextResponse.json(
      {
        id: created.id,
        isVerified: created.isVerified,
        whatsAppLink: created.toWhatsAppDeepLink(teamPhone),
        createdAt: created.createdAt,
      },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 422, headers: NO_STORE },
      );
    }
    return serverError('POST /api/logistics', error);
  }
}
