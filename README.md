# ProyectoMapa

Plataforma de monitoreo satelital y logística humanitaria (MVP). Muestra en un mapa los
focos de calor detectados por los satélites VIIRS (NASA FIRMS) sobre Perú y las solicitudes
de ayuda humanitaria **ya verificadas** por el equipo de respuesta.

- Cualquier persona puede registrar una solicitud desde el formulario (ubicación por GPS o,
  si se deniega, con un pin manual en un mini-mapa). La solicitud queda en estado
  `pendiente` y la persona recibe un enlace de WhatsApp hacia el **equipo de respuesta**
  para pedir la verificación.
- Los verificadores inician sesión en `/login` y aprueban o rechazan las pendientes en
  `/verify`. Solo las solicitudes `verificado` aparecen en el mapa público, sin datos
  personales.
- Los focos se sincronizan cada hora desde NASA FIRMS a Postgres/PostGIS (job de `pg_cron`
  que llama a `/api/cron/firms-sync`) y el mapa los lee de la base de datos.

## Stack

- **Next.js 16** (App Router, Turbopack, `src/proxy.ts`) + **React 19**
- **TypeScript 7** estricto (con TypeScript 6 en paralelo para las herramientas, ver más abajo)
- **Zod 4** para validación en el borde y en el cliente
- **Supabase**: Postgres + PostGIS, Auth (`@supabase/ssr`), `pg_cron`, `pg_net` y Vault.
  La clave `service_role` solo se usa en el servidor.
- **Leaflet / react-leaflet** + `supercluster` para el mapa, **Tailwind CSS 4** para estilos
- **react-hook-form** para el formulario
- **Vitest** + Testing Library (jsdom) para tests, **ESLint 9** con `eslint-config-next`

## Arquitectura por capas

```
src/
├── domain/            Sin dependencias externas.
│   ├── entities/      Entidades inmutables (Hotspot, LogisticsRequest con estado de 3 valores).
│   ├── providers/     Contrato IHotspotProvider (origen externo de focos).
│   ├── repositories/  Contratos de persistencia (IHotspotRepository, ILogisticsRepository).
│   └── types/         Tipos de dominio (urgencia, categorías, estado de verificación…).
├── application/
│   ├── dto/           Formatos de transporte GeoJSON públicos (focos y logística).
│   ├── mappers/       Entidad → vista pública / GeoJSON (sin nombre, teléfono ni descripción).
│   ├── ports/         Puertos que implementa infraestructura (p. ej. IRateLimiter).
│   ├── schemas/       Schemas Zod del formulario.
│   └── use-cases/     Casos de uso con inyección por constructor (enviar, listar, decidir,
│                      sincronizar focos, leer focos activos).
├── infrastructure/    Los módulos sensibles importan `server-only`.
│   ├── adapters/      NasaFirmsAdapter (implementa IHotspotProvider).
│   ├── auth/          Cliente de sesión @supabase/ssr y comprobación de la tabla `verifiers`.
│   ├── config/        Configuración (número de WhatsApp del equipo).
│   ├── database/      Repositorios Supabase/PostGIS y rate limiter (RPC en Postgres).
│   └── http/          Utilidades HTTP (IP del cliente).
├── presentation/      Componentes React (mapa, formulario, filtros), hooks y tipos de la UI
│                      (`presentation/types` re-exporta los DTO de `application/dto`).
├── app/               Rutas de Next: páginas (`/`, `/login`, `/verify`) y API.
└── proxy.ts           Refresca la sesión de Supabase en `/login`, `/verify` y `/api/verify/*`.
```

Las dependencias apuntan hacia dentro: `app` y `presentation` usan `application`, que usa
`domain`; `infrastructure` implementa los contratos de `domain`/`application`. Ningún archivo
de `domain/`, `application/` ni `infrastructure/` importa de `@/presentation`.

## Rutas

| Ruta | Método | Auth | Qué hace |
|---|---|---|---|
| `/` | página | pública | Mapa de focos y solicitudes verificadas, filtros y formulario de solicitud. |
| `/login` | página | pública | Inicio de sesión de verificadores (email + contraseña). Rate limit: 10 intentos / 15 min por IP. Si la cuenta no está en `verifiers`, se cierra la sesión. |
| `/verify` | página | sesión + fila en `verifiers` | Cola de solicitudes pendientes (más antiguas primero, máx. 200) con nombre, teléfono, descripción y ubicación; botones aprobar/rechazar. Sin sesión → redirige a `/login`. |
| `/admin` | página | sesión + `verifiers` con rol `admin` | Gestión del equipo: alta de cuentas (correo, contraseña temporal y rol), cambio de rol, desactivar/reactivar y cambio de contraseña. Un admin no puede quitarse el rol ni desactivarse, y la base de datos impide quedarse sin admins activos. Un `verificador` es redirigido a `/verify`. |
| `/api/hotspots` | GET | pública | Focos persistidos en GeoJSON. Parámetros: `hours` (1–168, por defecto 48), `bbox=oeste,sur,este,norte`, `min_frp`. `Cache-Control: s-maxage=900, stale-while-revalidate`. |
| `/api/logistics` | GET | pública | Solicitudes verificadas como vista pública (sin PII). Filtros `region`, `urgency` y `categories`. `s-maxage=300, stale-while-revalidate=60`. |
| `/api/logistics` | POST | pública | Crea una solicitud `pendiente` (validada con Zod). Rate limit: 5 envíos / hora por IP → `429` + `Retry-After`. Devuelve el enlace de WhatsApp al equipo. |
| `/api/logistics/geojson` | GET | pública | Igual que el GET anterior, en GeoJSON (lo usa el mapa). `s-maxage=300, stale-while-revalidate=60`: una aprobación aparece en el mapa en ≤ 5 min. |
| `/api/verify/[id]` | PATCH | sesión + `verifiers` + mismo origen | Cuerpo `{ "status": "verificado" }` o `{ "status": "rechazado", "reason": "…" }` (motivo de 3–300 caracteres). `401` sin sesión, `403` sin permiso u otro origen, `404` si no existe, `409` si ya fue revisada. |
| `/api/cron/firms-sync` | GET | `Authorization: Bearer $CRON_SECRET` | Descarga FIRMS (últimos 2 días, bbox de Perú) y hace upsert en `hotspots`. Idempotente. `401` sin Bearer válido; `500` si falta `CRON_SECRET`. |

Las respuestas de error 5xx llevan un mensaje genérico; el detalle solo va a `console.error`.

## Requisitos

- Node.js 22 o superior y npm
- Un proyecto de Supabase con las extensiones PostGIS, `pg_cron` y `pg_net` disponibles
- Una MAP_KEY de NASA FIRMS (registro gratuito en <https://firms.modaps.eosdis.nasa.gov/api/>)

## Variables de entorno

Copia `.env.example` a `.env.local` (desarrollo) y configura las mismas variables en el
hosting:

| Variable | Ámbito | Descripción |
|---|---|---|
| `NASA_FIRMS_API_KEY` | servidor | MAP_KEY de NASA FIRMS. Va en la ruta de la URL de FIRMS (llamada servidor→servidor), nunca se expone al cliente. Solo la usa el sync. |
| `NEXT_PUBLIC_SUPABASE_URL` | público | URL del proyecto Supabase (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | Anon key. Solo se usa para la sesión de los verificadores (`/login`, `/verify`, proxy); tras las migraciones no tiene permisos sobre ninguna tabla. |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | Clave `service_role` (salta RLS). Nunca con prefijo `NEXT_PUBLIC_`. Debe estar configurada **antes** de aplicar `002_lock_down.sql`. |
| `SUPABASE_URL` | servidor (opcional) | Alternativa a `NEXT_PUBLIC_SUPABASE_URL` para el cliente `service_role`. |
| `RESPONSE_TEAM_WHATSAPP` | servidor | WhatsApp del equipo de respuesta en formato internacional, 9–15 dígitos (p. ej. `51987654321`). Los enlaces `wa.me` apuntan a este número, nunca al del solicitante. |
| `CRON_SECRET` | servidor | **Obligatorio.** Secreto del sync de focos (`Authorization: Bearer <CRON_SECRET>`). Valor largo y aleatorio (p. ej. `openssl rand -hex 32`); el mismo valor va en Supabase Vault como `cron_secret`. |

## Base de datos: migraciones

Están en `supabase/migrations/` y se aplican **en orden** (SQL Editor de Supabase o
`supabase db push`):

| Migración | Contenido |
|---|---|
| `001_create_logistics_requests.sql` | Tabla `logistics_requests`, extensión PostGIS, índices. |
| `002_lock_down.sql` | RLS + `REVOKE` a `anon`/`authenticated` (deny-by-default). Requiere `SUPABASE_SERVICE_ROLE_KEY` ya configurada. |
| `003_rate_limit.sql` | Tabla `request_rate_limits` y función atómica `consume_rate_limit` (solo `service_role`). |
| `004_hotspots.sql` | Tabla `hotspots` (`geography(Point,4326)` + GiST), RPC `hotspots_in_bbox` y `prune_hotspots`. |
| `005_verification.sql` | Sustituye `is_verified` por `status` (`pendiente`/`verificado`/`rechazado`, migrando datos), añade `verified_by`, `verified_at`, `rejection_reason`, trigger de `updated_at` y la tabla `verifiers`. **Elimina la columna `is_verified`.** |
| `006_schedule_firms_sync.sql` | `pg_cron` + `pg_net`: sync horario (minuto 15) leyendo URL y secreto de Vault, y retención diaria de 30 días (04:30 UTC). |
| `007_logistics_geom.sql` | Columna generada `geom geography(Point,4326)` en `logistics_requests` + índice GiST. No cambia el código de escritura. |
| `008_verifier_admin.sql` | Columna `disabled_at` en `verifiers` (baja sin borrar, para conservar `verified_by`) y trigger `ensure_active_admin` que impide dejar el sistema sin admins activos. |

## Despliegue (Vercel Hobby + Supabase)

Vercel Hobby solo permite cron diario, así que el sync horario lo programa Supabase con
`pg_cron` + `pg_net` llamando a la ruta protegida del despliegue.

1. **Supabase: crear el proyecto** y anotar URL, anon key y `service_role` key
   (Project Settings → API).
2. **Vercel: importar el repositorio y configurar todas las variables** de la tabla anterior
   (Production, y Preview si se usa) **antes de migrar**. Genera `CRON_SECRET` con
   `openssl rand -hex 32`.
3. **Desplegar** el código en Vercel y anotar el dominio de producción.
4. **Aplicar migraciones `001` → `004`** en orden.
5. **Aplicar `005` a la vez que el código que la usa.** `005` elimina `is_verified`; el código
   actual ya usa `status`, así que despliega esta versión y aplica `005` en el mismo momento
   (si en producción corre una versión anterior, dejará de listar/crear solicitudes hasta que
   se actualice).
6. **Crear los secretos en Vault** (SQL Editor) **antes** de `006`:

   ```sql
   select vault.create_secret('https://<tu-dominio>/api/cron/firms-sync', 'firms_sync_url');
   select vault.create_secret('<mismo valor que CRON_SECRET en Vercel>', 'cron_secret');
   ```

   Para rotar: `select vault.update_secret(id, '<nuevo>')` con el `id` de `vault.secrets`,
   y actualizar `CRON_SECRET` en Vercel (y redesplegar).
7. **Aplicar `006`, `007` y `008`.** En un despliegue existente, aplica `008` **antes** de
   desplegar el código que la usa: la comprobación de sesión filtra por `disabled_at` y,
   sin esa columna, el login y `/verify` fallan.
8. **Desactivar el sign-up público**: Authentication → Sign In / Providers → desmarcar
   "Allow new users to sign up".
9. **Dar de alta el primer administrador** (solo una vez): Authentication → Users →
   "Add user" → "Create new user" (email + contraseña, marcando "Auto Confirm User"), y
   después en el SQL Editor:

   ```sql
   INSERT INTO verifiers (user_id, email, role)
   SELECT id, email, 'admin' FROM auth.users WHERE email = 'persona@ejemplo.org';
   ```

   El resto del equipo se gestiona desde `/admin` (enlace "Equipo" en `/verify`). Las bajas
   se hacen desactivando la cuenta, no borrándola: así se conserva quién verificó cada
   solicitud y la cuenta se puede reactivar.

10. **Comprobar el cron**:

    ```bash
    # Debe responder 200 con { "fetched": N, "upserted": M }
    curl -i -H "Authorization: Bearer $CRON_SECRET" https://<tu-dominio>/api/cron/firms-sync
    # Debe responder 401
    curl -i https://<tu-dominio>/api/cron/firms-sync
    ```

    Y en Supabase, tras el minuto 15 de la hora:

    ```sql
    select * from cron.job_run_details order by start_time desc limit 20;
    select * from net._http_response order by created desc limit 20;  -- status_code 200
    ```

11. **Comprobar el cierre de la base de datos**: una petición a PostgREST con la anon key
    sobre `logistics_requests`, `hotspots` o `verifiers` debe fallar con `permission denied`.

## Flujo de verificación

1. Una persona envía el formulario en `/` → `POST /api/logistics` crea la solicitud en
   `pendiente` y devuelve un enlace `wa.me` al número de `RESPONSE_TEAM_WHATSAPP` con el ID
   y la urgencia.
2. El equipo recibe el WhatsApp; un verificador entra en `/login` y abre `/verify`.
3. En `/verify` ve los datos completos (nombre, teléfono, descripción, ubicación) y
   **aprueba** o **rechaza** (con motivo) → `PATCH /api/verify/[id]`. Se guardan
   `verified_by` y `verified_at`; la actualización solo se aplica si sigue `pendiente`
   (`409` si otro verificador ya decidió).
4. Las aprobadas aparecen en el mapa en ≤ 5 minutos (caché de CDN de 300 s). Las rechazadas
   no vuelven a la cola ni se publican.

La pertenencia a `verifiers` se comprueba en cada página y endpoint (no solo en el proxy),
validando el JWT con `auth.getUser()`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm start` | Sirve el build |
| `npm run typecheck` | `tsc --noEmit` con TypeScript 7 |
| `npm run lint` | `eslint .` (core-web-vitals + typescript) |
| `npm test` | Ejecuta la suite de Vitest una vez |
| `npm run test:watch` | Vitest en modo watch |

### TypeScript 7 y TypeScript 6 en paralelo

`typescript-eslint` todavía no soporta la API de TypeScript 7. Siguiendo la
[recomendación oficial](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0),
`package.json` declara:

- `@typescript/native` → `npm:typescript@^7.0.2` (proporciona el binario `tsc`, usado por
  `typecheck`)
- `typescript` → `npm:@typescript/typescript6@^6.0.2` (API de TS 6 para ESLint; Next.js lo
  usa en el build)

### Tests

Los tests viven junto al código (`*.test.ts`). El entorno por defecto es `node`; los tests de
hooks y componentes declaran `// @vitest-environment jsdom`. `server-only` se sustituye por un
módulo vacío (`test/server-only.stub.ts`) mediante alias en `vitest.config.mts`.

## Pendientes

- **Content-Security-Policy**: una CSP estricta rompería las teselas de OSM/Leaflet; hay que
  diseñarla con las fuentes de teselas permitidas. Hoy `next.config.ts` aplica el resto de
  cabeceras de seguridad.
- **5.4** (baja prioridad): usar `IMapLayer` en `MapInner` y el contrato vacío
  `sanitized-upload/IImageSanitizer`.
- **Caché offline de teselas** para conexiones 3G rurales: service worker que cachee **solo
  teselas ya vistas** (la política de uso de OSM prohíbe la descarga masiva) o un proveedor
  de teselas con licencia offline.
- **`npm audit`**: hay avisos (severidad alta) en dependencias de desarrollo de la cadena de
  ESLint (`eslint-config-next` → `@next/eslint-plugin-next`); no afectan al bundle de producción. Revisar al actualizar `eslint-config-next`.

## Seguridad

- **Nunca hagas commit de `.env` ni `.env.local`.** El `.gitignore` ya los excluye; solo
  `.env.example` (sin valores) se versiona.
- `SUPABASE_SERVICE_ROLE_KEY` salta RLS: no la uses en código de cliente ni con prefijo
  `NEXT_PUBLIC_`. Los módulos que la leen importan `server-only`.
- Todas las tablas tienen RLS sin policies y sin grants para `anon`/`authenticated`: solo el
  servidor (`service_role`) lee y escribe.
- Las respuestas públicas no contienen nombre, teléfono ni descripción del solicitante.
- `CRON_SECRET` se compara en tiempo constante; `PATCH /api/verify/[id]` exige mismo origen
  (protección CSRF). Las cookies de sesión de `@supabase/ssr` son legibles por JS: la
  seguridad descansa en la revalidación en el servidor.
- Si una clave se filtra, rótala de inmediato en Supabase / NASA FIRMS / Vault y en Vercel.
