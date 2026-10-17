CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS logistics_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  region TEXT NOT NULL,
  district TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  categories TEXT[] NOT NULL DEFAULT '{}',
  urgency TEXT NOT NULL CHECK (urgency IN ('critico', 'moderado', 'cubierto')),
  description TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logistics_requests_is_verified
  ON logistics_requests (is_verified);

CREATE INDEX IF NOT EXISTS idx_logistics_requests_region
  ON logistics_requests (region);

CREATE INDEX IF NOT EXISTS idx_logistics_requests_urgency
  ON logistics_requests (urgency);

CREATE INDEX IF NOT EXISTS idx_logistics_requests_categories
  ON logistics_requests USING GIN (categories);
