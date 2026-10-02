-- E2E-reached authorization repair.
-- The maintenance work-order SELECT policy was still bound to the retired
-- public.get_user_project_id() helper. Keep the existing write boundary and
-- align only row visibility with the current project authorization kernel.
drop policy if exists sel_mwo on public.maintenance_work_orders;
create policy sel_mwo on public.maintenance_work_orders
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));
