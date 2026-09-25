BEGIN;

SELECT plan(8);

SELECT ok(
  NOT has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot use the private authorization schema'
);

SELECT ok(
  NOT has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated cannot use the private authorization schema directly'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text)',
    'EXECUTE'
  ),
  'anon cannot execute MRX capture'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text)',
    'EXECUTE'
  ),
  'authenticated can reach MRX only through server-side authorization'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date)',
    'EXECUTE'
  ),
  'anon cannot execute invoice creation'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.mizan_record_payment(uuid,numeric,text,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute payment recording'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'st_estimatedextent'
  ),
  'PostGIS estimated extent remains present; exposure requires an extension-owner/admin hardening step'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'mrx_capture_meter_reading'
      AND p.prosecdef
      AND pg_get_functiondef(p.oid) LIKE '%SET search_path TO ''''%' 
  ),
  'MIZAN SECURITY DEFINER RPCs keep an empty search path'
);

SELECT * FROM finish();

ROLLBACK;
