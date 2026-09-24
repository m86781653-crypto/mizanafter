BEGIN;

SELECT plan(14);

SELECT has_table('public', 'tenants', 'tenant hierarchy exists');
SELECT has_column('public', 'profiles', 'tenant_id', 'profiles have tenant scope');
SELECT has_column('public', 'projects', 'tenant_id', 'projects have tenant scope');
SELECT has_table('public', 'mizan_permissions', 'permission catalogue exists');
SELECT has_table('public', 'mizan_role_permissions', 'role permission matrix exists');

SELECT has_function(
  'private',
  'mizan_user_role',
  ARRAY[]::text[],
  'central role resolver exists'
);

SELECT has_function(
  'private',
  'mizan_can_access_project',
  ARRAY['uuid']::text[],
  'tenant project access function exists'
);

SELECT has_function(
  'private',
  'mizan_can_write_project',
  ARRAY['uuid','text','text']::text[],
  'operation authorization function exists'
);

SELECT has_policy('public', 'projects', 'sel_projects', 'project select policy exists');
SELECT has_policy('public', 'meter_readings', 'mizan_tenant_select', 'meter reading tenant select policy exists');
SELECT has_policy('public', 'meter_readings', 'mizan_tenant_insert', 'meter reading insert policy exists');
SELECT has_policy('public', 'payments', 'mizan_tenant_insert', 'payment insert policy exists');
SELECT has_policy('public', 'audit_logs', 'ins_audit', 'audit direct insert policy exists');
SELECT has_column('public', 'audit_logs', 'project_id', 'audit logs have governance scope');

SELECT * FROM finish();

ROLLBACK;
