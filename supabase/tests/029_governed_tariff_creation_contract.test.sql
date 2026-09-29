BEGIN;
SELECT plan(12);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='mizan_create_tariff_with_tiers'
      AND pg_get_function_identity_arguments(p.oid) =
        'p_project_id uuid, p_name_ar text, p_customer_type text, p_fixed_fee numeric, p_base_liters_per_person_per_day numeric, p_base_price_per_m3 numeric, p_reference_period_days integer, p_tiers jsonb'
  ),
  'governed tariff creation RPC exists with the production contract'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname='mizan_create_tariff_with_tiers'
      AND p.prosecdef
  ),
  'tariff creation RPC is SECURITY DEFINER so table grants remain closed'
);

SELECT ok(
  pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_tariff_with_tiers'
  )) LIKE '%set search_path = ''''%',
  'tariff creation RPC pins an empty search_path'
);

SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.mizan_create_tariff_with_tiers(uuid,text,text,numeric,numeric,numeric,integer,jsonb)',
    'EXECUTE'
  ),
  'authenticated can execute governed tariff creation'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.mizan_create_tariff_with_tiers(uuid,text,text,numeric,numeric,numeric,integer,jsonb)',
    'EXECUTE'
  ),
  'anon cannot execute governed tariff creation'
);

SELECT ok(
  NOT has_function_privilege(
    'public',
    'public.mizan_create_tariff_with_tiers(uuid,text,text,numeric,numeric,numeric,integer,jsonb)',
    'EXECUTE'
  ),
  'PUBLIC cannot execute governed tariff creation'
);

SELECT ok(
  NOT has_table_privilege('authenticated','public.tariffs','INSERT')
  AND NOT has_table_privilege('authenticated','public.tariff_tiers','INSERT'),
  'authenticated cannot bypass the governed tariff boundary with direct inserts'
);

SELECT ok(
  pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_tariff_with_tiers'
  )) LIKE '%mizan_can_write_project(p_project_id, ''tariffs'', ''insert'')%',
  'tariff creation is authorization-checked against project billing permission'
);

SELECT ok(
  pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_tariff_with_tiers'
  )) LIKE '%TARIFF_TIER_GAP%'
  AND pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_tariff_with_tiers'
  )) LIKE '%TARIFF_TIER_OVERLAP%',
  'tier gaps and overlaps are rejected before a tariff is exposed'
);

SELECT ok(
  pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_tariff_with_tiers'
  )) LIKE '%TARIFF_TIER_COVERAGE_REQUIRED%',
  'tier coverage must terminate in an open-ended tier'
);

SELECT ok(
  pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_tariff_with_tiers'
  )) LIKE '%current_date%'
  AND pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_tariff_with_tiers'
  )) LIKE '%version%',
  'effective date and version are server-controlled'
);

SELECT ok(
  pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_tariff_with_tiers'
  )) LIKE '%jsonb_to_recordset%',
  'tariff tiers are persisted atomically through the governed RPC'
);

SELECT * FROM finish();
ROLLBACK;
