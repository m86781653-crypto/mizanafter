BEGIN;

SELECT plan(14);

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
  'authenticated can reach MRX RPC; authorization is enforced inside the SECURITY DEFINER function'
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
  has_function_privilege(
    'authenticated',
    'public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date)',
    'EXECUTE'
  ),
  'authenticated can reach invoice RPC; authorization is enforced inside the SECURITY DEFINER function'
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
  has_function_privilege(
    'authenticated',
    'public.mizan_record_payment(uuid,numeric,text,text,text)',
    'EXECUTE'
  ),
  'authenticated can reach payment RPC; authorization is enforced inside the SECURITY DEFINER function'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.mizan_create_subtenant(text,text,text)',
    'EXECUTE'
  ),
  'legacy subtenant RPC is control-plane only'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.mizan_create_subtenant(text,text,text)',
    'EXECUTE'
  ),
  'anon cannot execute legacy subtenant RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'private.mizan_can_access_project(uuid)',
    'EXECUTE'
  ),
  'anon cannot execute private project authorization helper'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'private.mizan_can_access_project(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute private project authorization helper directly'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'private.mizan_is_platform_admin()',
    'EXECUTE'
  ),
  'authenticated cannot execute private platform-admin helper directly'
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
  'MRX SECURITY DEFINER RPC keeps an empty search path'
);

SELECT * FROM finish();

ROLLBACK;
