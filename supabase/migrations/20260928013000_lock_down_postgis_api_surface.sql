-- Lock down PostGIS Data API surface without changing application-facing PostGIS usage.
-- spatial_ref_sys is an extension-owned lookup table; revoke client access rather than enabling RLS.
revoke all on table public.spatial_ref_sys from anon, authenticated;

-- st_estimatedextent is not part of the MIZAN client API.
revoke execute on function public.st_estimatedextent(text,text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text,boolean) from public, anon, authenticated;