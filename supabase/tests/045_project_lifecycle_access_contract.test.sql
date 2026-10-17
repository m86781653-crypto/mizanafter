begin;
select plan(5);

with fn as (
  select pg_get_functiondef('private.mizan_can_access_project(uuid)'::regprocedure) as definition
)
select ok(
  definition ~* $$private\.mizan_is_platform_admin\(\)$$,
  'platform-admin access path remains explicit'
) from fn;

with fn as (
  select pg_get_functiondef('private.mizan_can_access_project(uuid)'::regprocedure) as definition
)
select ok(
  definition ~* $$p\.status\s*=\s*'active'$$,
  'project access requires an active project'
) from fn;

with fn as (
  select pg_get_functiondef('private.mizan_can_access_project(uuid)'::regprocedure) as definition
)
select ok(
  definition ~* $$t\.status\s*=\s*'active'$$,
  'same-tenant access requires an active tenant'
) from fn;

with fn as (
  select pg_get_functiondef('private.mizan_can_access_project(uuid)'::regprocedure) as definition
)
select ok(
  definition ~* $$parent\.status\s*=\s*'active'$$,
  'subtenant access requires an active parent tenant'
) from fn;

select ok(
  (select prosecdef and coalesce(array_to_string(proconfig, ','), '') like '%search_path=%'
   from pg_proc where oid = 'private.mizan_can_access_project(uuid)'::regprocedure),
  'project access helper remains SECURITY DEFINER with an explicit search_path'
);

select * from finish();
rollback;
