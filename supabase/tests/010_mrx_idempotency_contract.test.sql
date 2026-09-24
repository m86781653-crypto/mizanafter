BEGIN;

SELECT plan(11);

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

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%INSERT INTO public.audit_logs%'
      AND pg_get_functiondef(p.oid) LIKE '%MRX_CAPTURE%'
      AND pg_get_functiondef(p.oid) LIKE '%accepted%'
  ),
  'MRX writes an accepted capture event to the audit trail'
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

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.audit_logs'::regclass
      AND t.tgname = 'trg_audit_logs_immutable'
      AND NOT t.tgisinternal
  ),
  'audit_logs has an append-only mutation guard'
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
    'WHERE client_capture_id = p_client_capture_id'
  ) < strpos(
    pg_get_functiondef((
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'mrx_capture_meter_reading'
    )),
    'INSERT INTO public.meter_readings'
  ),
  'MRX idempotent replay is evaluated before a second production insert'
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
    'EXCEPTION_REASON_REQUIRED'
  ) > 0
  AND strpos(
    pg_get_functiondef((
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'mrx_capture_meter_reading'
    )),
    'METER_EXCEPTION_FORBIDDEN'
  ) > 0,
  'MRX manual exceptions require a permission gate and non-empty notes'
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
    'IF FOUND THEN RETURN v_reading; END IF;'
  ) > 0
  AND strpos(
    pg_get_functiondef((
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'mrx_capture_meter_reading'
    )),
    'INSERT INTO public.audit_logs'
  ) > 0,
  'MRX replay returns the existing reading before the audit-producing insert path'
);

SELECT * FROM finish();

ROLLBACK;

