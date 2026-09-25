-- PostGIS owns spatial_ref_sys. Keep read access for CRS metadata while removing
-- direct mutation privileges from API roles. RLS is intentionally not added here
-- because spatial_ref_sys is extension-owned and used by PostGIS internals.
revoke insert, update, delete, truncate, references, trigger on table public.spatial_ref_sys from anon, authenticated;
