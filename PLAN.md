# Plan de Cierre — Plataforma de Monitoreo Satelital y Logística Humanitaria

> **Versión:** 2 (revisada 2026-10-16 tras verificación de viabilidad)
> **Estado del código hoy:** `npm run build` OK · typecheck OK (vía `node node_modules/typescript/lib/tsc.js`; el shim `.bin/tsc` estaba roto) · 0 `any`
> **Hallazgo crítico nuevo:** la integración con NASA FIRMS **nunca ha funcionado** — la URL del adaptador tiene el formato equivocado (verificado contra la API real: responde 400 `Invalid source / Invalid area / Invalid day range`).
> **Alcance:** 7 fases (0–6) para que la app funcione, cerrar los huecos de seguridad/antifraude, completar la verificación y elevar la calidad.

**Decisiones confirmadas**
- Tabla con RLS + `service_role`
- Persistencia de focos en Postgres con sync programado
- Panel web de verificación con Supabase Auth y roles
- Rate limiting con contador en Postgres (vía función RPC atómica)
- El enlace de WhatsApp apunta al **equipo de respuesta**, nunca al solicitante

**Dependencias a instalar:** `server-only` (Fase 1), `vitest` + `eslint` + `eslint-config-next` (Fase 6), `@supabase/ssr` (Fase 4)

---

## Auditoría del estado actual

### Lo que ya funciona

| Capa | Estado |
|---|---|
| `domain/` | Entidades inmutables (`Object.freeze`), contratos `IHotspotRepository` / `ILogisticsRepository` |
| `application/` | 3 use-cases con inyección por constructor, schemas Zod, mappers GeoJSON |
| `infrastructure/` | Parser CSV propio, descarta `confidence==='l'`, bbox Perú; repo con `is_verified=false` forzado |
| `presentation/` | `supercluster`, `CircleMarker` por FRP, RHF+Zod, GPS con estados |
| API | `s-maxage` en GET, `no-store` en POST, validación Zod en el borde |
| DB | CHECK en urgencia, índice GIN sobre `categories` |

### Huecos encontrados

**Críticos — funcionamiento**

0a. **URL de FIRMS incorrecta.** El adaptador usa `/api/area/csv/{source}/{bbox}/{days}?MAP_KEY=…`; el formato real es `/api/area/csv/{MAP_KEY}/{source}/{bbox}/{days}`. El mapa nunca ha mostrado focos.
0b. **`useMapData` silencia los errores HTTP** (`readJson` devuelve `null` si `!res.ok`) → se muestra "0 focos" en vez de un error. Por esto 0a pasó desapercibido.
0c. **`HotspotLayer` solo recalcula clusters en `zoomend`**, no en `moveend` → al desplazar el mapa no aparecen focos fuera del encuadre inicial.
0d. **Sin git ni `.gitignore`** — crítico antes de introducir `SUPABASE_SERVICE_ROLE_KEY` en `.env`.

**Críticos — seguridad / antifraude**

1. **No hay RLS.** Con la anon key pública cualquiera puede leer pendientes o hacer `PATCH is_verified = true` vía PostgREST.
2. **Fuga de PII.** `GET /api/logistics` serializa entidades completas (teléfono, nombre, descripción). **`/geojson` también filtra el teléfono**: va dentro de `whatsAppLink` (`wa.me/51XXXXXXXXX`).
3. **Enlace de WhatsApp invertido.** Apunta al propio solicitante con el texto "solicito verificación de mi reporte" — tras enviar, el usuario se escribe a sí mismo.
4. **Sin rate limiting** en `POST /api/logistics`.
5. **`/api/cron/firms-sync` público**; `CRON_SECRET` no se usa.
6. **El servidor escribe con la anon key.**
7. **Errores internos expuestos** (`error.message` de Supabase en respuestas) y JSON mal formado en `POST` → 500 en vez de 400.

**Arquitectura**

8. `application/mappers/*.ts` importan de `@/presentation/types` (inversión de capas).
9. `IMapLayer` declarada pero no usada.
10. No existe `IHotspotProvider` (separar origen FIRMS de persistencia Postgres).
11. `infrastructure/sanitized-upload/` no existe.

**Funcional**

12. **No hay flujo de verificación** → la capa de logística siempre vacía.
13. **El estado es booleano** pero el dominio tiene 3 estados (`pendiente/verificado/rechazado`): "rechazar" con `is_verified=false` es indistinguible de pendiente.
14. PostGIS habilitado pero no usado.
15. Los focos no se persisten.
16. Formulario sin fallback si se deniega el GPS.
17. Escala de color FRP incoherente: >60 MW en ámbar (parece menos grave que el rojo de 30–60 MW).
18. Cambiar cualquier filtro re-pide **ambas** fuentes (FIRMS incluido).

**Calidad**

19. 0 tests.
20. Sin ESLint; `npm run lint` roto (`next lint` eliminado en Next 16).
21. Sin `next.config.ts`, sin README.
22. Directorio basura `src/app/{api` (brace expansion fallida).
23. Tiles OSM sin caché — restricción "3G rural" no abordada.

> **Descartado:** "mover `MAP_KEY` a header `Authorization`" — FIRMS no lo soporta; la key va en el path. Mitigación: no loguear la URL (llamada servidor→servidor).

---

## Fase 0 — Que la app funcione (nueva)

| Item | Acción |
|---|---|
| 0a | Corregir URL FIRMS a `${BASE}/${MAP_KEY}/${source}/${bbox}/${days}`. No incluir la URL en mensajes de error. Exportar `parseCsv` para tests |
| 0b | `useMapData`: propagar errores HTTP al estado `error`; separar la carga de focos y de logística en efectos independientes (resuelve 18) |
| 0c | `HotspotLayer`: recalcular clusters en `moveend` (cubre zoom y pan) |
| 17 | Escala FRP monótona: verde → ámbar → naranja → rojo |
| 0d / 22 | `.gitignore` (`node_modules`, `.next`, `.env*` salvo `.env.example`, `*.tsbuildinfo`); borrar `src/app/{api`; reinstalar `node_modules` |

**Aceptación:** con una `NASA_FIRMS_API_KEY` válida el mapa muestra focos; con una inválida se ve el banner de error.

---

## Fase 1 — Cerrar la tabla (crítico)

**`supabase/migrations/002_lock_down.sql`**

```sql
ALTER TABLE logistics_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE logistics_requests FROM anon, authenticated;
-- RLS + sin grants = deny-by-default. service_role bypassa RLS.
```

**`supabase.client.ts`** — `import 'server-only'`, `SUPABASE_SERVICE_ROLE_KEY` (sin `NEXT_PUBLIC_`), patrón lazy.

**Orden de despliegue:** configurar `SUPABASE_SERVICE_ROLE_KEY` en el entorno **antes** de aplicar `002`, o la app deja de funcionar. La anon key pública se mantiene: la Fase 4 la necesita para el login.

**Aceptación:** `curl` a PostgREST con anon key → `permission denied`. Build OK.

---

## Fase 2 — PII, WhatsApp y rate limiting

**2.1 WhatsApp al equipo.** `LogisticsRequest.toWhatsAppDeepLink(teamPhone)` recibe el número del equipo (variable `RESPONSE_TEAM_WHATSAPP`, leída en infraestructura, nunca en dominio). Mensaje desde la perspectiva del solicitante con el ID y la urgencia. Así **ninguna respuesta pública contiene el teléfono del solicitante**.

**2.2 Vista pública.** `public-logistics-view.mapper.ts`: id, región, distrito, urgencia, categorías, enlace WhatsApp (al equipo). Sin `fullName`, `phone` ni `description`. Usado en `GET /api/logistics` y `/geojson`.

**2.3 Rate limiting** — `003_rate_limit.sql`:

```sql
CREATE TABLE request_rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0
);
ALTER TABLE request_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE request_rate_limits FROM anon, authenticated;

CREATE FUNCTION consume_rate_limit(p_bucket TEXT, p_limit INT, p_window_seconds INT)
RETURNS TABLE (allowed BOOLEAN, retry_after INT) ...
-- INSERT ... ON CONFLICT (bucket) DO UPDATE SET
--   count = CASE WHEN window expirada THEN 1 ELSE count + 1 END,
--   window_start = CASE WHEN window expirada THEN now() ELSE window_start END
-- RETURNING ... (atómico, sin carrera read-then-write)
REVOKE EXECUTE ON FUNCTION consume_rate_limit FROM anon, authenticated, public;
```

`rate-limiter.repository.ts` llama con `.rpc()`. Límite: **5 envíos/hora por IP** → `429` + `Retry-After`. IP: `x-real-ip` o primera entrada de `x-forwarded-for` (válido en Vercel, que reescribe la cabecera; revisar si se cambia de hosting). Limpieza de filas viejas: `DELETE ... WHERE window_start < now() - interval '1 day'` dentro de la función o por cron.

**2.4 Errores.** JSON mal formado → 400. Respuestas 5xx con mensaje genérico; el detalle va a `console.error`.

**Aceptación:** ninguna respuesta GET contiene teléfono o nombre; 6.º envío en la hora → 429.

---

## Fase 3 — Persistencia de focos + sync protegido

**Contratos:**
- `IHotspotProvider` (nuevo) — origen externo: `fetchRecent(): Promise<Hotspot[]>`. Lo implementa `NasaFirmsAdapter`.
- `IHotspotRepository` — persistencia: `upsert(hotspots)`, `findActive({ since, bbox?, minFrp? })`. Lo implementa `PostgisHotspotRepository`.

**`004_hotspots.sql`**: tabla `hotspots` con `firms_id TEXT UNIQUE`, `geom geography(Point,4326)`, índice GiST, índice en `acquisition_date`, RLS + `REVOKE`. Función RPC `hotspots_in_bbox(since, west, south, east, north, min_frp)` que devuelve `ST_X(geom::geometry) AS longitude, ST_Y(...) AS latitude, ...`.

**Escritura:** `.upsert(rows, { onConflict: 'firms_id' })` con `geom` como texto EWKT `'SRID=4326;POINT(lng lat)'` (Postgres lo castea; `ST_MakePoint` no es invocable desde PostgREST).

**Rutas:**

| Ruta | Método | Auth | Función |
|---|---|---|---|
| `/api/cron/firms-sync` | **GET** (Vercel Cron solo hace GET) | `Authorization: Bearer $CRON_SECRET` | FIRMS → tabla. Idempotente |
| `/api/hotspots` | GET | público | Lee de Postgres, ventana por defecto **últimas 48 h**, `s-maxage=900` |

**Frecuencia:** FIRMS NRT llega con ~3 h de latencia → sync cada **1–3 h**. Vercel Hobby solo permite cron diario → usar `pg_cron` + `pg_net` en Supabase, o Vercel Pro.

**Aceptación:** sin key de FIRMS el mapa sirve los focos ya sincronizados; llamada al sync sin Bearer → 401.

---

## Fase 4 — Auth y panel de verificación

**`005_verification.sql`**
- Reemplazar `is_verified BOOLEAN` por `status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','verificado','rechazado'))` (migrando datos), más `verified_by UUID`, `verified_at TIMESTAMPTZ`, trigger de `updated_at`.
- Tabla `verifiers (user_id → auth.users, email, role IN ('admin','verificador'))` con RLS sin policies.

**Sesión:** `@supabase/ssr` + **`src/proxy.ts`** (en Next 16 `middleware.ts` se renombró a `proxy.ts`) para refrescar la sesión. La pertenencia a `verifiers` se comprueba **en cada página y en cada endpoint**, no solo en el layout. Nota: las cookies de `@supabase/ssr` son legibles por JS; la seguridad descansa en la revalidación server-side.

**Rutas:** `/login` (sign-up público deshabilitado en Supabase), `/verify` (lista pendientes con teléfono y descripción), `PATCH /api/verify/[id]` con `{ status: 'verificado' | 'rechazado' }`.

**Aceptación:** verificador aprueba → aparece en el mapa; no verificador → 403; rechazado no vuelve a la cola.

---

## Fase 5 — Arquitectura y UX

- **5.1** Mover tipos GeoJSON a `src/application/dto/geojson.ts` (formato de transporte, no dominio).
- **5.2** Fallback de GPS: pin manual en un mapa pequeño dentro del formulario (incluido en esta tanda).
- **5.3** `geom` en `logistics_requests` como **columna generada**: `GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED` + GiST. Sin tocar el código de escritura.
- **5.4** (baja prioridad) `IMapLayer` en `MapInner`; contrato vacío `sanitized-upload/IImageSanitizer`.

---

## Fase 6 — Calidad e infraestructura

| Item | Acción |
|---|---|
| Tests | `vitest`: parser CSV (comillas, CRLF), descarte `confidence==='l'`, URL FIRMS, límites Zod, invariante `is_verified=false`, deep-link WhatsApp al equipo, vista pública sin PII, rate limiter |
| ESLint | `eslint.config.mjs` plano con `eslint-config-next`; script `lint` → `eslint .` |
| `next.config.ts` | Cabeceras de seguridad (`X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy: geolocation=(self)`) |
| README | Setup, variables, migraciones, cron, flujo de verificación |
| 3G rural | Service worker que cachea **solo teselas ya vistas** (la política de OSM prohíbe la descarga masiva) o proveedor de tiles con licencia offline |

---

## Orden y ejecución

```
Fase 0 (funciona)           --> primero
Fase 1 (RLS)                --> antes que cualquier otra cosa de backend
Fase 2 (PII + rate limit)   --> necesita Fase 1
Fase 6 parcial (tests, lint, README, next.config)
Fase 3 (hotspots + sync)    --> necesita Fase 1 y decisión de hosting
Fase 4 (auth + panel)       --> necesita Fase 1
Fase 5                      --> en paralelo
```

### Tanda 1 (completada 2026-10-16) — agentes y propiedad de archivos

> Resultado: Fases 0, 1, 2 y 6 parcial hechas. `typecheck`, `lint`, `test` (135 tests) y `build` en verde.
> Pendiente de Tanda 1 trasladado a Fase 3: `/api/cron/firms-sync` sigue público (sin `CRON_SECRET`).
> TypeScript: `typescript` = TS 6 (API para typescript-eslint y Next), `@typescript/native` = TS 7 (`tsc` del script `typecheck`).

| Agente | Fases | Archivos que posee |
|---|---|---|
| **A · frontend-firms** | 0a, 0b, 0c, 17 | `infrastructure/adapters/nasa-firms.adapter.ts`, `presentation/hooks/useMapData.ts`, `presentation/components/map/*` |
| **B · seguridad-backend** | 1, 2 | `supabase/migrations/002*`, `003*`, `infrastructure/database/*`, `infrastructure/config/*`, `domain/entities/logistics-request.entity.ts`, `application/mappers/logistics-*`, `application/mappers/public-*`, `app/api/logistics/**`, `.env.example` |
| **C · calidad** | 6 parcial | `package.json` (scripts/devDeps), `eslint.config.mjs`, `vitest.config.ts`, `next.config.ts`, `README.md`, `**/*.test.ts`. Corre **después** de A y B |

### Tanda 2 (completada 2026-10-16)

| Agente | Fases | Resultado |
|---|---|---|
| **D · focos** | 3 | Tabla `hotspots` (004) + RPC `hotspots_in_bbox` / `prune_hotspots`; `IHotspotProvider` (FIRMS) separado de `IHotspotRepository` (Postgres); `GET /api/cron/firms-sync` con Bearer `CRON_SECRET` (comparación en tiempo constante); `GET /api/hotspots` público desde Postgres (48 h por defecto); pg_cron horario + retención 30 días vía Vault (006) |
| **E · verificación** | 4 | `status` de 3 estados + `verified_by/at`, `rejection_reason`, trigger `updated_at`, tabla `verifiers` (005); `@supabase/ssr` + `src/proxy.ts`; `/login` (rate limit 10/15 min), `/verify`, `PATCH /api/verify/[id]` (Origin, 401/403/404/409) |
| **F · ubicación** | 5.2 | Pin manual en mini-mapa si falla el GPS; coordenadas restringidas al bbox de Perú en el schema |
| **Cierre** | 5.1, 5.3 | DTOs GeoJSON en `application/dto/`; `geom` generada + GiST en `logistics_requests` (007); caché de logística a `s-maxage=300`; README de despliegue |

**Orden de migraciones:** 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008. La 005 elimina `is_verified`: desplegar código y migración a la vez. Antes de la 006, crear en Vault `firms_sync_url` y `cron_secret`.

### Tanda 3 (en curso)

| Item | Estado |
|---|---|
| **Panel de verificadores** | Hecho (2026-10-18). `/admin` solo para rol `admin`: alta (usuario de Auth confirmado + fila en `verifiers`, con compensación si falla), cambio de rol, desactivar/reactivar (`disabled_at`, 008) y cambio de contraseña. Un admin no puede degradarse ni desactivarse; el trigger `ensure_active_admin` garantiza al menos un admin activo. Las cuentas desactivadas pierden el acceso en la siguiente petición |
| CSP | Pendiente |
| Caché offline de tiles (respetando la política de OSM) | Pendiente |
| 5.4 (`IMapLayer`, contrato `sanitized-upload`) | Pendiente |
| Avisos de `npm audit` en devDeps de ESLint | Pendiente |

---

## Decisiones pendientes

1. ~~Hosting~~ → resuelto: Vercel Hobby + `pg_cron`/`pg_net` en Supabase (sync horario).
2. **Número de WhatsApp del equipo de respuesta** — necesario para `RESPONSE_TEAM_WHATSAPP`.
3. ~~Geometría en `logistics_requests`~~ → resuelto: columna generada (5.3).
4. ~~Fallback de GPS~~ → resuelto: incluido (5.2).
