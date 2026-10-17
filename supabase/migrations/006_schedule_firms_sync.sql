-- Programa el sync horario de FIRMS (Vercel Hobby solo permite cron diario).
--
-- ANTES de aplicar esta migración, crear en Supabase Vault (SQL Editor):
--
--   select vault.create_secret('https://<dominio>/api/cron/firms-sync', 'firms_sync_url');
--   select vault.create_secret('<mismo valor que CRON_SECRET en Vercel>', 'cron_secret');
--
-- Para rotar: select vault.update_secret(id, '<nuevo>') con el id de vault.secrets.
-- No escribir aquí URLs ni secretos reales.
--
-- Comprobar ejecuciones: select * from cron.job_run_details order by start_time desc limit 20;
-- y respuestas HTTP: select * from net._http_response order by created desc limit 20;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'firms-sync-hourly') THEN
    PERFORM cron.unschedule('firms-sync-hourly');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hotspots-prune-daily') THEN
    PERFORM cron.unschedule('hotspots-prune-daily');
  END IF;
END;
$$;

-- Minuto 15 de cada hora. pg_net es asíncrono: la petición se encola y la respuesta
-- queda en net._http_response.
SELECT cron.schedule(
  'firms-sync-hourly',
  '15 * * * *',
  $$
  SELECT net.http_get(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'firms_sync_url'),
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- Retención de 30 días, a diario a las 04:30 UTC.
SELECT cron.schedule(
  'hotspots-prune-daily',
  '30 4 * * *',
  $$ SELECT public.prune_hotspots(30); $$
);
