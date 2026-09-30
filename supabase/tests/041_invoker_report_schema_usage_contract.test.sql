begin;
select plan(4);

select is(
  has_schema_privilege('authenticated','private','USAGE'),
  true,
  'authenticated can resolve private authorization helpers used by invoker reports'
);

select is(
  has_function_privilege('authenticated','public.mizan_operational_report(uuid,date,date)','EXECUTE'),
  true,
  'authenticated can execute the operational report RPC'
);

select is(
  has_function_privilege('authenticated','public.mizan_maintenance_report(uuid,date,date)','EXECUTE'),
  true,
  'authenticated can execute the maintenance report RPC'
);

select ok(
  (select not p.prosecdef from pg_proc p where p.oid='public.mizan_operational_report(uuid,date,date)'::regprocedure)
  and
  (select not p.prosecdef from pg_proc p where p.oid='public.mizan_maintenance_report(uuid,date,date)'::regprocedure),
  'report RPCs remain SECURITY INVOKER while private helper resolution is available'
);

select * from finish();
rollback;
