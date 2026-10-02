-- E2E-reached authorization repair.
-- The affected SECURITY INVOKER operational report reads meter_readings for
-- reading quality and water-balance metrics. The legacy SELECT policy still
-- called public.get_user_project_id(), whose client EXECUTE privilege is
-- intentionally revoked. Preserve project scoping through the current
-- authorization kernel.
drop policy if exists sel_readings on public.meter_readings;
create policy sel_readings on public.meter_readings
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));
