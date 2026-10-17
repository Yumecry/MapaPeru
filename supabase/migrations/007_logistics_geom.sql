-- Fase 5.3 — Geometría en logistics_requests como columna generada.
--
-- La calcula Postgres a partir de latitude/longitude: el código de escritura no cambia
-- (no inserta ni actualiza geom). El repositorio selecciona columnas explícitas, así que
-- geom no viaja a la aplicación.
--
-- Coherente con 004_hotspots.sql: PostGIS puede estar en el schema public o en extensions
-- (según cómo se habilitara en Supabase); se fija el search_path de la transacción para
-- resolver geography, ST_SetSRID y ST_MakePoint en ambos casos. La expresión queda ligada
-- a las funciones resueltas al crear la columna.
-- Añadir una columna STORED reescribe la tabla (bloqueo breve con pocos datos).

BEGIN;

SET LOCAL search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE logistics_requests
  ADD COLUMN IF NOT EXISTS geom geography(Point, 4326)
    GENERATED ALWAYS AS (
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_logistics_requests_geom
  ON logistics_requests USING GIST (geom);

COMMIT;
