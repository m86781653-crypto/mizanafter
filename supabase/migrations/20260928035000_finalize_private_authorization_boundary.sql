-- Final privilege boundary for the private authorization schema and legacy subtenant RPC.
-- SECURITY DEFINER functions remain callable internally by service_role but are not directly exposed to client roles.

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.f);
  end loop;
end $$;

revoke all on function public.mizan_create_subtenant(text,text,text) from public, anon, authenticated;
grant execute on function public.mizan_create_subtenant(text,text,text) to service_role;
