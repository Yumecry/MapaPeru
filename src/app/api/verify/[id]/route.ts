import { NextRequest, NextResponse } from 'next/server';
import { getAuthState } from '@/infrastructure/auth/session';
import { PostgisLogisticsRepository } from '@/infrastructure/database/postgis-logistics.repository';
import { StatusConflictError } from '@/domain/repositories/logistics.repository';
import {
  DecideLogisticsRequestUseCase,
  LogisticsRequestNotFoundError,
} from '@/application/use-cases/decide-logistics-request.use-case';
import { NO_STORE, badRequest, serverError } from '@/app/api/logistics/_lib/responses';
import { decisionSchema, requestIdSchema } from '../_lib/decision.schema';
import { isSameOrigin } from '../_lib/origin';

export const dynamic = 'force-dynamic';

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request.headers)) {
    return errorResponse(403, 'Origen no permitido');
  }

  try {
    const auth = await getAuthState();
    if (auth.kind === 'anonymous') {
      return errorResponse(401, 'Debe iniciar sesión');
    }
    if (auth.kind === 'forbidden') {
      return errorResponse(403, 'No tiene permisos de verificación');
    }

    const { id } = await params;
    if (!requestIdSchema.safeParse(id).success) {
      return badRequest('Identificador de solicitud inválido');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('El cuerpo de la solicitud no es un JSON válido');
    }

    const decision = decisionSchema.safeParse(body);
    if (!decision.success) {
      const reasonIssue = decision.error.issues.find((issue) => issue.path[0] === 'reason');
      return badRequest(
        reasonIssue?.message ??
          "Decisión inválida: use { status: 'verificado' } o { status: 'rechazado', reason }",
      );
    }

    const updated = await new DecideLogisticsRequestUseCase(
      new PostgisLogisticsRepository(),
    ).execute({
      requestId: id,
      verifierId: auth.verifier.userId,
      decision: decision.data,
    });

    return NextResponse.json(
      { id: updated.id, status: updated.status, verifiedAt: updated.verifiedAt ?? null },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof LogisticsRequestNotFoundError) {
      return errorResponse(404, 'La solicitud no existe');
    }
    if (error instanceof StatusConflictError) {
      return errorResponse(409, 'La solicitud ya fue revisada');
    }
    return serverError('PATCH /api/verify/[id]', error);
  }
}
