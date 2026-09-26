BEGIN;

SELECT plan(10);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_invoice'
      AND pg_get_function_identity_arguments(p.oid)='p_project_id uuid, p_customer_id uuid, p_meter_id uuid, p_period_start date, p_period_end date'
      AND pg_get_functiondef(p.oid) LIKE '%source_reading_id%'
  ),
  'invoice issuance is bound to an MRX source reading'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.invoices'::regclass
      AND tgname='mizan_bind_invoice_source_reading'
      AND NOT tgisinternal
  ),
  'invoice source-reading trigger exists'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.invoices'::regclass
      AND tgname='mizan_sync_meter_after_invoice'
      AND NOT tgisinternal
  ),
  'meter baseline sync trigger exists'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND tablename='invoices'
      AND indexname='invoices_source_reading_uidx'
  ),
  'one invoice per source reading is enforced'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='invoices'
      AND column_name='source_reading_id'
  ),
  'invoices expose source reading identity'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tariffs'
      AND column_name='customer_type'
  ),
  'tariffs are customer-type scoped'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tariffs'
      AND column_name='effective_from'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tariffs'
      AND column_name='effective_to'
  ),
  'tariffs support effective-date selection'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tariff_tiers'
      AND column_name='from_m3'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tariff_tiers'
      AND column_name='to_m3'
  )
  AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tariff_tiers'
      AND column_name='price_per_m3'
  ),
  'tariff tiers contain bounded volume and price fields'
);

SELECT ok(
  pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_invoice'
      AND pg_get_function_identity_arguments(p.oid)='p_project_id uuid, p_customer_id uuid, p_meter_id uuid, p_period_start date, p_period_end date'
  )) LIKE '%ACTIVE_TARIFF_NOT_FOUND%'
  AND pg_get_functiondef((
    SELECT p.oid FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='mizan_create_invoice'
      AND pg_get_function_identity_arguments(p.oid)='p_project_id uuid, p_customer_id uuid, p_meter_id uuid, p_period_start date, p_period_end date'
  )) LIKE '%TARIFF_COVERAGE_INCOMPLETE%',
  'invoice issuance rejects missing or incomplete tariff coverage'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.mizan_create_invoice(uuid,uuid,uuid,date,date)',
    'EXECUTE'
  )
  AND has_function_privilege(
    'authenticated',
    'public.mizan_create_invoice(uuid,uuid,uuid,date,date)',
    'EXECUTE'
  ),
  'invoice issuance RPC is callable only by authenticated clients'
);

SELECT ok(
  NOT has_table_privilege('anon','public.invoices','INSERT')
  AND NOT has_table_privilege('authenticated','public.invoices','INSERT'),
  'client roles cannot bypass governed invoice issuance'
);

SELECT * FROM finish();
ROLLBACK;