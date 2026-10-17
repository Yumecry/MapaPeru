-- Fase 4 — Verificación de solicitudes.
--
-- Alta de un verificador (no hay registro público):
--   1. Supabase Dashboard > Authentication > Sign In / Providers: desactivar
--      "Allow new users to sign up" (sign-up público deshabilitado).
--   2. Authentication > Users > "Add user" > "Create new user": email + contraseña,
--      marcando "Auto Confirm User".
--   3. En el SQL Editor, registrar al usuario como verificador:
--        INSERT INTO verifiers (user_id, email, role)
--        SELECT id, email, 'verificador' FROM auth.users WHERE email = 'persona@ejemplo.org';
--      (usar role 'admin' para administradores).
-- Baja: DELETE FROM verifiers WHERE email = '...'; (o borrar el usuario de Auth).

BEGIN;

ALTER TABLE logistics_requests
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente', 'verificado', 'rechazado'));

UPDATE logistics_requests
  SET status = CASE WHEN is_verified THEN 'verificado' ELSE 'pendiente' END;

DROP INDEX IF EXISTS idx_logistics_requests_is_verified;
ALTER TABLE logistics_requests DROP COLUMN IF EXISTS is_verified;

CREATE INDEX IF NOT EXISTS idx_logistics_requests_status
  ON logistics_requests (status);

ALTER TABLE logistics_requests
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_logistics_requests_updated_at ON logistics_requests;
CREATE TRIGGER trg_logistics_requests_updated_at
  BEFORE UPDATE ON logistics_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS verifiers (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'verificador')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS sin policies + sin grants = deny-by-default; solo service_role (servidor) accede.
ALTER TABLE verifiers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE verifiers FROM anon, authenticated;

COMMIT;
