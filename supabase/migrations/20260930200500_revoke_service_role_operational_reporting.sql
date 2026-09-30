-- Keep operational reporting on the authenticated application path only.
revoke execute on function public.mizan_maintenance_report(uuid,date,date) from public,anon,service_role;
grant execute on function public.mizan_maintenance_report(uuid,date,date) to authenticated;