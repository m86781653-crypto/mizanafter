-- Explicitly revoke PostGIS catalog table privileges from browser roles.
revoke all privileges on table
  public.spatial_ref_sys,
  public.geography_columns,
  public.geometry_columns
from anon, authenticated;
