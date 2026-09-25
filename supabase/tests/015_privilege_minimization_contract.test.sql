BEGIN;

SELECT plan(8);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public'
      AND indexname='profiles_required_role_per_tenant_uidx'
      AND indexdef LIKE '%UNIQUE INDEX%'
  ),
  'required operational roles are uniquely constrained per tenant'
);

SELECT ok(
  NOT has_table_privilege('anon','public.seq_counters','SELECT')
  AND NOT has_table_privilege('authenticated','public.seq_counters','SELECT'),
  'sequence counters are not directly readable by client roles'
);

SELECT ok(
  NOT has_table_privilege('anon','public.seq_counters','INSERT')
  AND NOT has_table_privilege('authenticated','public.seq_counters','INSERT'),
  'sequence counters are not directly writable by client roles'
);

SELECT ok(
  NOT has_table_privilege('anon','public.project_seq_counters','SELECT')
  AND NOT has_table_privilege('authenticated','public.project_seq_counters','SELECT'),
  'project sequence counters are not directly readable by client roles'
);

SELECT ok(
  NOT has_table_privilege('anon','public.project_seq_counters','UPDATE')
  AND NOT has_table_privilege('authenticated','public.project_seq_counters','UPDATE'),
  'project sequence counters are not directly writable by client roles'
);

SELECT ok(
  NOT has_table_privilege('anon','public.invoices','TRUNCATE')
  AND NOT has_table_privilege('authenticated','public.invoices','TRUNCATE'),
  'client roles cannot truncate invoices'
);

SELECT ok(
  NOT has_table_privilege('anon','public.meter_readings','TRIGGER')
  AND NOT has_table_privilege('authenticated','public.meter_readings','TRIGGER'),
  'client roles cannot install triggers on meter readings'
);

SELECT ok(
  NOT has_table_privilege('anon','public.profiles','REFERENCES')
  AND NOT has_table_privilege('authenticated','public.profiles','REFERENCES'),
  'client roles cannot add references to profiles'
);

SELECT * FROM finish();

ROLLBACK;
