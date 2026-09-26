-- PostGIS exposes ST_EstimatedExtent as extension-owned functions in public.
-- The application does not call this function; clients must not execute it directly.
revoke execute on function public.st_estimatedextent(text,text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text,boolean) from anon, authenticated;
