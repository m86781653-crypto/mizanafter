-- E2E-reached authorization repair.
-- The fault SELECT policy still used the retired public.get_user_project_id()
-- helper. Align row visibility with the current project authorization kernel
-- without altering the fault workflow or write boundary.
drop policy if exists sel_faults on public.faults;
create policy sel_faults on public.faults
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));
