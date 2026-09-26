-- Defense-in-depth record for PostGIS estimated extent RPC hardening.
-- The extension currently retains EXECUTE privileges on these C functions in the
-- production PostGIS installation; the production migration attempts to revoke
-- PUBLIC/anon/authenticated execution without changing extension-owned objects.
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text,text,text,boolean) FROM PUBLIC, anon, authenticated;
