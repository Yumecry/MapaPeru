# ProyectoMapa

Plataforma de monitoreo satelital y logística humanitaria (MVP). Muestra en un mapa los
focos de calor detectados por los satélites VIIRS (NASA FIRMS) sobre Perú y las solicitudes
de ayuda humanitaria **ya verificadas** por el equipo de respuesta. Cualquier persona puede
registrar una solicitud desde el formulario; queda en estado `pendiente` y recibe un enlace de
WhatsApp para pedir la verificación al equipo.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript 7** estricto (con TypeScript 6 en paralelo para las herramientas, ver más abajo)
- **Zod 4** para validación en el borde y en el cliente
- **Supabase** (Postgres + PostGIS) con la clave `service_role` solo en el servidor
- **Leaflet / react-leaflet** + `supercluster` para el mapa, **Tailwind CSS 4** para estilos
- **react-hook-form** para el formulario
- **Vitest** + Testing Library (jsdom) para tests, **ESLint 9** con `eslint-config-next`

## Arquitectura por capas

```
src/
├── domain/          Entidades inmutables (Hotspot, LogisticsRequest), tipos y contratos
│                    de repositorio. Sin dependencias externas.
├── application/     Casos de uso (inyección por constructor), schemas Zod, mappers a
│                    vistas públicas/GeoJSON y puertos (p. ej. IRateLimiter).
├── infrastructure/  Implementaciones: adaptador NASA FIRMS, repositorio Supabase/PostGIS,
│                    rate limiter (RPC en Postgres), configuración y utilidades HTTP.
│                    Los módulos sensibles importan `server-only`.
├── presentation/    Componentes React (mapa, formulario, filtros) y hooks.
└── app/             Rutas de Next: página y API (`/api/logistics`, `/api/logistics/geojson`,
                     `/api/cron/firms-sync`).
```

Las dependencias apuntan hacia dentro: `app` y `presentation` usan `application`, que usa
`domain`; `infrastructure` implementa los contratos de `domain`/`application`.

## Requisitos

- Node.js 22 o superior y npm
- Un proyecto de Supabase con la extensión PostGIS disponible
- Una MAP_KEY de NASA FIRMS (registro gratuito en <https://firms.modaps.eosdis.nasa.gov/api/>)

## Variables de entorno

Copia `.env.example` a `.env.local` y complétalo:

| Variable | Ámbito | Descripción |
|---|---|---|
| `NASA_FIRMS_API_KEY` | servidor | MAP_KEY de NASA FIRMS. Va en la ruta de la URL de FIRMS, nunca se expone al cliente. |
| `NEXT_PUBLIC_SUPABASE_URL` | público | URL del proyecto Supabase (Project Settings → API). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | público | Anon key. Hoy **no** se usa en el servidor; se reserva para el login (Fase 4). |
| `SUPABASE_SERVICE_ROLE_KEY` | **solo servidor** | Clave `service_role`. Nunca con prefijo `NEXT_PUBLIC_`. Debe estar configurada **antes** de aplicar `002_lock_down.sql`. |
| `SUPABASE_URL` | servidor (opcional) | Alternativa a `NEXT_PUBLIC_SUPABASE_URL` para el servidor. |
| `RESPONSE_TEAM_WHATSAPP` | servidor | WhatsApp del equipo de respuesta en formato internacional, 9–15 dígitos (p. ej. `51987654321`). Los enlaces `wa.me` apuntan a este número; nunca al del solicitante. |
| `CRON_SECRET` | servidor | Secreto para proteger el job de sincronización. Aún **no se aplica** (ver estado actual). |

## Base de datos: migraciones

Aplica las migraciones de `supabase/migrations/` **en orden** (SQL Editor de Supabase o
`supabase db push`):

1. `001_create_logistics_requests.sql` — tabla `logistics_requests`, PostGIS, índices.
2. `002_lock_down.sql` — activa RLS y revoca los permisos de `anon`/`authenticated`
   (deny-by-default).
   > **Importante:** configura `SUPABASE_SERVICE_ROLE_KEY` en el servidor (local y en el
   > hosting) **antes** de aplicar esta migración. A partir de aquí la anon key ya no puede
   > leer ni escribir la tabla y la app dejaría de funcionar sin la clave de servicio.
3. `003_rate_limit.sql` — tabla `request_rate_limits` y función `consume_rate_limit`
   usada para limitar los envíos (5 por IP y hora).

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

- `@typescript/native` → `typescript@^7` (proporciona el binario `tsc`, usado por `typecheck`)
- `typescript` → `@typescript/typescript6` (API de TS 6 para ESLint; Next.js lo usa en el build)

### Tests

Los tests viven junto al código (`*.test.ts`). El entorno por defecto es `node`; los tests de
hooks y componentes declaran `// @vitest-environment jsdom`. `server-only` se sustituye por un
módulo vacío (`test/server-only.stub.ts`) mediante alias en `vitest.config.mts`.

## Estado actual

**Funciona**

- Mapa con focos de calor de NASA FIRMS (VIIRS NOAA-20/21, sin confianza baja) agrupados con
  `supercluster` y coloreados por FRP; los clusters se recalculan al mover y al hacer zoom.
- Filtros por región, urgencia, categorías y FRP mínimo; cada filtro solo vuelve a pedir la
  fuente afectada. Los errores HTTP se muestran por fuente.
- Formulario de solicitud con GPS, validado con Zod en cliente y servidor.
- Tabla cerrada con RLS; el servidor usa la `service_role`.
- Las vistas públicas (`GET /api/logistics`, `/api/logistics/geojson`) no exponen nombre,
  teléfono ni descripción. El enlace de WhatsApp va al equipo de respuesta.
- Rate limiting en `POST /api/logistics`, errores internos ocultos con mensaje genérico.
- Cabeceras de seguridad en todas las rutas (`next.config.ts`).

**Falta (ver `PLAN.md`)**

- **Fase 3 — Persistencia de focos y cron protegido.** Hoy `/api/cron/firms-sync` consulta FIRMS
  en vivo en cada petición (cacheada en CDN) y es público: no persiste los focos ni comprueba
  `CRON_SECRET`.
- **Fase 4 — Autenticación y panel de verificación.** No hay panel: hoy las solicitudes solo se
  verifican **editando la tabla** `logistics_requests` en Supabase (`is_verified = true`). El
  estado "rechazado" aún no existe en la base de datos.
- **Fase 5 — Arquitectura y UX**, incluido el **fallback de GPS** (pin manual en el mapa) cuando
  el usuario deniega la geolocalización; hoy sin GPS no se puede enviar el formulario.
- **Content-Security-Policy** pendiente: una CSP estricta rompería las teselas de OSM/Leaflet;
  hay que diseñarla con las fuentes de teselas permitidas.
- Caché de teselas para conexiones 3G rurales.

## Seguridad

- **Nunca hagas commit de `.env` ni `.env.local`.** El `.gitignore` ya los excluye; solo
  `.env.example` (sin valores) se versiona.
- `SUPABASE_SERVICE_ROLE_KEY` salta RLS: no la uses en código de cliente ni con prefijo
  `NEXT_PUBLIC_`. Los módulos que la leen importan `server-only`.
- Si una clave se filtra, rótala de inmediato en Supabase / NASA FIRMS.
