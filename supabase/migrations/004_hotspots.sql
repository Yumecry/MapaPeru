-- Focos de calor sincronizados desde NASA FIRMS (VIIRS NRT).
-- Escritura y lectura solo vía service_role (/api/cron/firms-sync y /api/hotspots).

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firms_id TEXT UNIQUE NOT NULL,
  geom geography(Point, 4326) NOT NULL,
  frp DOUBLE PRECISION NOT NULL CHECK (frp >= 0),
  confidence TEXT NOT NULL CHECK (confidence IN ('n', 'h')),
  source TEXT NOT NULL,
  satellite TEXT NOT NULL,
  acquisition_date TIMESTAMPTZ NOT NULL,
  brightness DOUBLE PRECISION NOT NULL,
  scan DOUBLE PRECISION NOT NULL,
  track DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hotspots_geom ON hotspots USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hotspots_acquisition_date ON hotspots (acquisition_date DESC);

ALTER TABLE hotspots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE hotspots FROM anon, authenticated;

-- PostgREST no puede invocar ST_X/ST_Y en un select: la lectura va por RPC con columnas planas.
-- bbox opcional: solo se aplica si llegan las cuatro coordenadas.
CREATE OR REPLACE FUNCTION hotspots_in_bbox(
  p_since TIMESTAMPTZ,
  p_west FLOAT8 DEFAULT NULL,
  p_south FLOAT8 DEFAULT NULL,
  p_east FLOAT8 DEFAULT NULL,
  p_north FLOAT8 DEFAULT NULL,
  p_min_frp FLOAT8 DEFAULT 0
)
RETURNS TABLE (
  firms_id TEXT,
  longitude FLOAT8,
  latitude FLOAT8,
  frp FLOAT8,
  confidence TEXT,
  source TEXT,
  satellite TEXT,
  acquisition_date TIMESTAMPTZ,
  brightness FLOAT8,
  scan FLOAT8,
  track FLOAT8
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    h.firms_id,
    ST_X(h.geom::geometry) AS longitude,
    ST_Y(h.geom::geometry) AS latitude,
    h.frp,
    h.confidence,
    h.source,
    h.satellite,
    h.acquisition_date,
    h.brightness,
    h.scan,
    h.track
  FROM hotspots h
  WHERE h.acquisition_date >= p_since
    AND h.frp >= COALESCE(p_min_frp, 0)
    AND (
      p_west IS NULL OR p_south IS NULL OR p_east IS NULL OR p_north IS NULL
      OR ST_Intersects(
        h.geom,
        ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
      )
    )
  ORDER BY h.acquisition_date DESC;
$$;

REVOKE EXECUTE ON FUNCTION hotspots_in_bbox(TIMESTAMPTZ, FLOAT8, FLOAT8, FLOAT8, FLOAT8, FLOAT8)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION hotspots_in_bbox(TIMESTAMPTZ, FLOAT8, FLOAT8, FLOAT8, FLOAT8, FLOAT8)
  TO service_role;

-- Retención: borra focos adquiridos hace más de p_days días. Devuelve las filas borradas.
-- La invoca un job diario de pg_cron (006_schedule_firms_sync.sql).
CREATE OR REPLACE FUNCTION prune_hotspots(p_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF p_days IS NULL OR p_days < 1 THEN
    RAISE EXCEPTION 'prune_hotspots: p_days inválido';
  END IF;

  DELETE FROM hotspots
  WHERE acquisition_date < now() - make_interval(days => p_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION prune_hotspots(INT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION prune_hotspots(INT) TO service_role;
