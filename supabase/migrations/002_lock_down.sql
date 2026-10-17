-- Requisito: configurar SUPABASE_SERVICE_ROLE_KEY en el servidor ANTES de aplicar
-- esta migración; a partir de aquí la anon key no puede leer ni escribir la tabla.
ALTER TABLE logistics_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE logistics_requests FROM anon, authenticated;
-- RLS + sin grants = deny-by-default. service_role bypassa RLS.
