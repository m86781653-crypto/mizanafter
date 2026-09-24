BEGIN;

SELECT plan(21);

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
SELECT has_column('public', 'audit_logs', 'event_id', 'audit events have immutable event ids');
SELECT has_column('public', 'audit_logs', 'project_id', 'audit logs have governance scope');
SELECT has_column('public', 'meter_readings', 'client_capture_id', 'MRX captures have idempotency key');
SELECT has_column('public', 'meter_readings', 'ai_detected_meter_number', 'MRX captures store verified meter identity');
SELECT has_function(
  'public',
  'mrx_capture_meter_reading',
  ARRAY['uuid','numeric','timestamptz','text','text','numeric','numeric','numeric','numeric','numeric','text','text','uuid','text']::text[],
  'MRX server capture uses idempotent 14-argument identity-verified contract'
);
SELECT has_function(
  'public',
  'mizan_create_invoice',
  ARRAY['uuid','uuid','uuid','numeric','date','date']::text[],
  'server-authoritative invoice RPC exists'
);
SELECT has_function(
  'public',
  'mizan_record_payment',
  ARRAY['uuid','numeric','text','text','text']::text[],
  'server-authoritative payment RPC exists'
);
SELECT has_function(
  'private',
  'mizan_write_audit',
  ARRAY['uuid','text','text','uuid','jsonb','jsonb','text','text']::text[],
  'private audit writer exists'
);
SELECT has_function(
  'private',
  'mizan_audit_row_change',
  ARRAY[]::text[],
  'automatic critical-row audit trigger function exists'
);


SELECT * FROM finish();

ROLLBACK;
