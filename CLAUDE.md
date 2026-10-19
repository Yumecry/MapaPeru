# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Plataforma de monitoreo satelital (focos de calor NASA FIRMS sobre Perú) y logística humanitaria. Next.js 16 (App Router, `src/proxy.ts` en lugar de `middleware.ts`) + React 19 + Supabase (Postgres/PostGIS, Auth, `pg_cron`, Vault). Código, comentarios, mensajes de error y commits en español. `README.md` documenta rutas, variables de entorno, migraciones y despliegue en detalle; `PLAN.md` es el plan de fases/hallazgos.

## Comandos

```bash
npm run dev            # servidor de desarrollo
npm run build          # build de producción
npm run lint           # eslint .
npm run typecheck      # tsc (TS 7) y tsc6 (TS 6), ambos con --noEmit
npm test               # vitest run
npx vitest run src/app/api/hotspots/route.test.ts   # un archivo
npx vitest run -t "nombre del test"                 # por nombre
```

### TypeScript 7 y 6 en paralelo

`package.json` aliasa `@typescript/native` → `typescript@7` (da el binario `tsc`) y `typescript` → `@typescript/typescript6` (binario `tsc6`, API que usan ESLint y el build de Next). No "arregles" estos alias: `typescript-eslint` aún no soporta TS 7.

### Tests

- Junto al código (`*.test.ts`), solo bajo `src/`. Entorno `node` por defecto; los tests de hooks/componentes llevan `// @vitest-environment jsdom` en la cabecera.
- `server-only` se resuelve a `test/server-only.stub.ts` vía alias en `vitest.config.mts`.
- `restoreMocks`, `unstubEnvs` y `unstubGlobals` están activos: usa `vi.stubEnv` / `vi.stubGlobal` sin limpiar a mano.

## Arquitectura

Capas limpias con dependencias hacia dentro: `app` / `presentation` → `application` → `domain`; `infrastructure` implementa los contratos de `domain/repositories`, `domain/providers` y `application/ports`. **Nada en `domain/`, `application/` ni `infrastructure/` importa de `@/presentation`** (`presentation/types` re-exporta los DTO de `application/dto`, no al revés).

- **Route handlers como composition root**: cada `route.ts` instancia los repositorios/adaptadores concretos y los inyecta por constructor en el use-case (`new XUseCase(new PostgisLogisticsRepository())`). No hay contenedor de DI. Helpers propios de una ruta van en carpetas `_lib/` junto a ella.
- **Entidades inmutables** (`Object.freeze`). `LogisticsRequest` tiene `status` de tres valores: `pendiente` / `verificado` / `rechazado` (la antigua columna `is_verified` ya no existe).
- **Focos**: `NasaFirmsAdapter` (`IHotspotProvider`) → `SyncHotspotsUseCase` → `PostgisHotspotRepository` (upsert). El mapa nunca llama a FIRMS directamente: lee `/api/hotspots`, que consulta Postgres (RPC `hotspots_in_bbox`). El sync lo dispara cada hora `pg_cron` + `pg_net` desde Supabase contra `/api/cron/firms-sync` con `Authorization: Bearer $CRON_SECRET` (URL y secreto en Vault); no hay cron de Vercel.
- **Solicitudes**: `POST /api/logistics` crea en `pendiente` (Zod + rate limit vía RPC `consume_rate_limit`) y devuelve un enlace `wa.me` al **equipo de respuesta** (`RESPONSE_TEAM_WHATSAPP`), nunca al solicitante. Verificadores aprueban/rechazan en `/verify` → `PATCH /api/verify/[id]` (mismo origen, `409` si ya no está `pendiente`).
- **Mapa**: Leaflet solo en cliente (`MapContainerClient` carga `MapInner` dinámicamente), clustering con `supercluster`, datos vía `useMapData`.

## Invariantes de seguridad

- Toda la base de datos es deny-by-default: RLS sin policies y sin grants a `anon`/`authenticated`. **Todo acceso a datos va por el servidor con `service_role`** (`infrastructure/database/supabase.client.ts`). La anon key solo sirve para la sesión de Auth de los verificadores.
- Los módulos que leen secretos importan `server-only`; mantenlo al añadir nuevos.
- Las respuestas públicas pasan por los mappers de `application/mappers` (`toPublicLogisticsView`, GeoJSON), que eliminan nombre, teléfono y descripción. No serialices entidades directamente.
- `src/proxy.ts` solo refresca la sesión; la autorización (sesión validada con `auth.getUser()` + fila en `verifiers`) se comprueba en **cada** página y endpoint de verificación.
- Errores 5xx con mensaje genérico; el detalle solo a `console.error` (ver `api/logistics/_lib/responses.ts`).
- Mantén las cabeceras `Cache-Control` existentes (`s-maxage` en GET públicos, `no-store` en POST/verificación).

## Base de datos

Migraciones SQL numeradas en `supabase/migrations/`, aplicadas en orden (SQL Editor o `supabase db push`). Añade una nueva migración (`008_...sql`) en vez de editar las existentes. El orden de despliegue importa (p. ej. `SUPABASE_SERVICE_ROLE_KEY` configurada antes de `002`, secretos de Vault antes de `006`); ver README.
