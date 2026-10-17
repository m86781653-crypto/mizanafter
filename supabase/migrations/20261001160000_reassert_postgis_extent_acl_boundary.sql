-- Re-apply the PostGIS client execution boundary after the complete extension
-- and application migration set. The contract test found explicit ACL entries
-- for PUBLIC, anon, and authenticated despite earlier revocation migrations.
begin;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as function_signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'st_estimatedextent'
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      r.function_signature
    );
  end loop;
end
$$;

commit;
