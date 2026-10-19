-- Tanda 3 — Administración de verificadores desde /admin.
--
-- La baja de un verificador se hace con disabled_at (no se borra la fila ni el usuario de
-- Auth) para conservar la trazabilidad de logistics_requests.verified_by y poder
-- reactivarlo. El acceso se revalida contra esta tabla en cada página y endpoint, así que
-- la baja es efectiva de inmediato aunque el JWT siga vigente.

BEGIN;

ALTER TABLE verifiers
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

-- Invariante: siempre queda al menos un admin activo. El advisory lock serializa los
-- cambios concurrentes (dos admins degradándose a la vez) para que el conteo sea fiable.
CREATE OR REPLACE FUNCTION ensure_active_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('verifiers_active_admin'));

  IF NOT EXISTS (
    SELECT 1 FROM verifiers WHERE role = 'admin' AND disabled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Debe quedar al menos un administrador activo'
      USING ERRCODE = 'P0001', HINT = 'last_active_admin';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_verifiers_active_admin ON verifiers;
CREATE CONSTRAINT TRIGGER trg_verifiers_active_admin
  AFTER UPDATE OR DELETE ON verifiers
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION ensure_active_admin();

COMMIT;
