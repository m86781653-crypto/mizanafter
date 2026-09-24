BEGIN;

SELECT plan(11);

SELECT has_column(
  'public',
  'meter_readings',
  'ai_detected_meter_number',
  'MRX stores the detected meter identity'
);

SELECT has_function(
  'public',
  'mrx_capture_meter_reading',
  ARRAY[
    'uuid','numeric','timestamptz','text','text','numeric','numeric','numeric',
    'numeric','numeric','text','text','uuid','text'
  ]::text[],
  'MRX exposes the 14-argument identity-verified contract'
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
  'MRX has exactly one public function signature'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%METER_IDENTITY_MISMATCH%'
  ),
  'MRX rejects missing or mismatched detected meter identity'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%READING_MUST_MATCH_OCR%'
  ),
  'MRX rejects a reading that differs from OCR'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%READING_DECREASE_REQUIRES_EXCEPTION%'
  ),
  'MRX rejects decreasing readings'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%PHOTO_OCR_REQUIRED%'
  ),
  'MRX requires photo OCR evidence'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%OCR_CONFIDENCE_TOO_LOW%'
  ),
  'MRX enforces the minimum OCR confidence'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%client_capture_id%'
  ),
  'MRX retains idempotency by client capture id'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND pg_get_functiondef(p.oid) LIKE '%METER_CAPTURE_FORBIDDEN%'
  ),
  'MRX enforces permission and project access'
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
  'MRX security-definer execution uses an empty search path'
);

SELECT * FROM finish();

ROLLBACK;
