BEGIN;

SELECT plan(8);

SELECT has_function(
  'public',
  'handle_new_user',
  ARRAY[]::text[],
  'auth profile provisioning trigger function exists'
);

SELECT is(
  (SELECT confdeltype FROM pg_constraint WHERE conname='audit_logs_project_id_fkey'),
  'r',
  'audit project foreign key is RESTRICT'
);

SELECT is(
  (SELECT confdeltype FROM pg_constraint WHERE conname='audit_logs_actor_user_id_fkey'),
  'r',
  'audit actor foreign key is RESTRICT'
);

SELECT is(
  has_function_privilege(
    'anon',
    'public.handle_new_user()',
    'execute'
  ),
  false,
  'anonymous clients cannot execute auth provisioning trigger function'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.handle_new_user()',
    'execute'
  ),
  false,
  'authenticated clients cannot execute auth provisioning trigger function'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='tenants'
      AND policyname='tenant_self_read'
      AND qual LIKE '%private.mizan_user_tenant_id%'
  ),
  'tenant policy uses internal authorization resolver'
);

SELECT is(
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relname <> 'spatial_ref_sys'),
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> 'spatial_ref_sys'),
  'all MIZAN public application tables have RLS enabled'
);

SELECT is(
  (SELECT extname FROM pg_extension WHERE extname='postgis'),
  'postgis',
  'PostGIS extension remains installed for spatial workflows'
);

SELECT * FROM finish();

ROLLBACK;
