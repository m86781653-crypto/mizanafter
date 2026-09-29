-- Explicitly lock the PostGIS client RPC/table grants that can be restored by extension defaults.
begin;

revoke execute on function public.st_estimatedextent(text,text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text,boolean) from anon, authenticated;

revoke select, insert, update, delete, truncate, references, trigger
on table public.spatial_ref_sys
from anon, authenticated;

commit;
