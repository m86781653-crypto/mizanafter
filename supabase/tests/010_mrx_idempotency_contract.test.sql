BEGIN;

SELECT plan(6);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%FOR UPDATE%'
  ),
  'MRX locks the meter row before evaluating capture idempotency'
);

SELECT ok(
  strpos(
    pg_get_functiondef((
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'mrx_capture_meter_reading'
    )),
    'METER_CAPTURE_FORBIDDEN'
  ) < strpos(
    pg_get_functiondef((
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'mrx_capture_meter_reading'
    )),
    'WHERE client_capture_id = p_client_capture_id'
  ),
  'MRX authorizes project access before idempotent capture lookup'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'meter_readings'
      AND indexname = 'ux_meter_readings_client_capture_id'
  ),
  'MRX has a unique client capture id guard'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND p.prosecdef = true
      AND pg_get_functiondef(p.oid) LIKE '%SET search_path TO ''''%' 
  ),
  'MRX remains SECURITY DEFINER with an empty search path'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%METER_IDENTITY_MISMATCH%'
      AND pg_get_functiondef(p.oid) LIKE '%READING_MUST_MATCH_OCR%'
      AND pg_get_functiondef(p.oid) LIKE '%READING_DECREASE_REQUIRES_EXCEPTION%'
  ),
  'MRX retains identity, OCR, and monotonic-reading gates'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
  ),
  1,
  'MRX exposes exactly one production capture signature'
);

SELECT * FROM finish();

ROLLBACK;
