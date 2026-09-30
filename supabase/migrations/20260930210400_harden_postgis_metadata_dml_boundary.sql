-- PostGIS catalog objects are extension metadata, not part of the MIZAN browser API.
-- Remove all client-role privileges while leaving extension ownership intact.
revoke all privileges on table
  public.spatial_ref_sys,
  public.geography_columns,
  public.geometry_columns
from public, anon, authenticated;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as f
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'st_estimatedextent'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.f);
  end loop;
end
$$;
