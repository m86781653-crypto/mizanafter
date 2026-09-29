-- PostGIS helper functions are not part of the MIZAN API surface.
-- Keep extension internals callable by their owning extension, but not by API roles.
revoke execute on function public.st_estimatedextent(text,text) from anon, authenticated, public;
revoke execute on function public.st_estimatedextent(text,text,text) from anon, authenticated, public;
revoke execute on function public.st_estimatedextent(text,text,text,boolean) from anon, authenticated, public;
