-- Security hardening: PostGIS catalog and estimated-extent helper are internal infrastructure.
-- Client roles do not need direct access to either surface.
revoke all on table public.spatial_ref_sys from public, anon, authenticated;

revoke all on function public.st_estimatedextent(text,text) from public, anon, authenticated;
revoke all on function public.st_estimatedextent(text,text,text) from public, anon, authenticated;
revoke all on function public.st_estimatedextent(text,text,text,boolean) from public, anon, authenticated;
