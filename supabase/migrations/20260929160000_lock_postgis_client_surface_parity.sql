-- Keep Production aligned with the repository's PostGIS client-surface contract.
begin;

revoke all on table public.spatial_ref_sys from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as f
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'st_estimatedextent'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      r.f
    );
  end loop;
end $$;

commit;
