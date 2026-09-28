begin;

select plan(7);

select ok(
  has_schema_privilege('authenticated','private','USAGE'),
  'authenticated retains USAGE on private schema required by RLS helper evaluation'
);

select ok(
  has_function_privilege('authenticated','private.mizan_user_tenant_id()','EXECUTE'),
  'authenticated can execute tenant helper used by RLS'
);

select ok(
  has_function_privilege('authenticated','private.mizan_user_role()','EXECUTE'),
  'authenticated can execute role helper used by RLS'
);

select ok(
  has_function_privilege('authenticated','private.mizan_is_platform_admin()','EXECUTE'),
  'authenticated can execute platform-admin helper used by RLS'
);

select ok(
  has_function_privilege('authenticated','private.mizan_has_permission(text)','EXECUTE'),
  'authenticated can execute permission helper used by RLS'
);

select ok(
  has_function_privilege('authenticated','private.mizan_can_access_project(uuid)','EXECUTE'),
  'authenticated can execute project-access helper used by RLS'
);

select ok(
  has_function_privilege('authenticated','private.mizan_can_write_project(uuid,text,text)','EXECUTE'),
  'authenticated can execute project-write helper used by RLS'
);

select * from finish();

rollback;
