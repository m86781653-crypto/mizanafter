-- Keep extension-managed GiST operator classes out of the exposed public schema.
-- PostGIS remains in public because Supabase owns public.spatial_ref_sys on this
-- project; moving PostGIS itself requires the Supabase-supported relocation path.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'btree_gist'
      AND n.nspname = 'public'
  ) THEN
    ALTER EXTENSION btree_gist SET SCHEMA extensions;
  END IF;
END
$$;
