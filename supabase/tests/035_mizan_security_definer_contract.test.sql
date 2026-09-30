begin;
select plan(6);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname like 'mizan_%'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  ),
  'no MIZAN SECURITY DEFINER function is executable by anon'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname like 'mizan_%'
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','),'') not like '%search_path=""%'
      and coalesce(array_to_string(p.proconfig, ','),'') not like '%search_path=pg_catalog, public%'
  ),
  'MIZAN SECURITY DEFINER functions use an explicit constrained search_path'
);

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='mizan_operational_report'
   limit 1),
  false,
  'operational reporting remains SECURITY INVOKER'
);

select ok(
  has_function_privilege('authenticated','public.mizan_operational_report(uuid,date,date)','execute'),
  'authenticated can execute governed operational reporting'
);

select ok(
  not has_function_privilege('anon','public.mizan_operational_report(uuid,date,date)','execute'),
  'anon cannot execute governed operational reporting'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname like 'mizan_%'
      and p.prosecdef
      and has_function_privilege('public', p.oid, 'execute')
  ),
  'PUBLIC cannot execute MIZAN SECURITY DEFINER functions'
);

select * from finish();
rollback;
