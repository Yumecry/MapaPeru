CREATE TABLE IF NOT EXISTS request_rate_limits (
  bucket TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_request_rate_limits_window_start
  ON request_rate_limits (window_start);

ALTER TABLE request_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE request_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION consume_rate_limit(
  p_bucket TEXT,
  p_limit INT,
  p_window_seconds INT
)
RETURNS TABLE (allowed BOOLEAN, retry_after INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window INTERVAL;
  v_count INT;
  v_window_start TIMESTAMPTZ;
BEGIN
  IF p_bucket IS NULL OR p_limit IS NULL OR p_limit < 1
     OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'consume_rate_limit: parámetros inválidos';
  END IF;

  v_window := make_interval(secs => p_window_seconds);

  -- Limpieza oportunista de ventanas antiguas.
  IF random() < 0.05 THEN
    DELETE FROM request_rate_limits
    WHERE window_start < v_now - INTERVAL '1 day';
  END IF;

  -- Atómico: en DO UPDATE, rl.* son los valores previos de la fila.
  INSERT INTO request_rate_limits AS rl (bucket, window_start, count)
  VALUES (p_bucket, v_now, 1)
  ON CONFLICT (bucket) DO UPDATE SET
    count = CASE
      WHEN rl.window_start <= v_now - v_window THEN 1
      ELSE rl.count + 1
    END,
    window_start = CASE
      WHEN rl.window_start <= v_now - v_window THEN v_now
      ELSE rl.window_start
    END
  RETURNING rl.count, rl.window_start INTO v_count, v_window_start;

  IF v_count <= p_limit THEN
    allowed := TRUE;
    retry_after := 0;
  ELSE
    allowed := FALSE;
    retry_after := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (v_window_start + v_window - v_now)))::INT
    );
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION consume_rate_limit(TEXT, INT, INT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_rate_limit(TEXT, INT, INT) TO service_role;
