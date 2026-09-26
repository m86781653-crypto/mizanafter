-- PostGIS system catalog is infrastructure, not an application data surface.
-- Keep it inaccessible to client roles and protected by RLS for PostgREST exposure.
alter table public.spatial_ref_sys enable row level security;
revoke all on table public.spatial_ref_sys from public, anon, authenticated;
