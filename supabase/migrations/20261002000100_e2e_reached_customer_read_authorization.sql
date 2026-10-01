-- Reached by isolated E2E after project, wells, pumps and tanks.
-- The authenticated customer SELECT path still depended on the revoked legacy
-- public.get_user_project_id() helper. Preserve the existing project scope and
-- use the current authorization kernel.
drop policy if exists sel_customers on public.customers;
create policy sel_customers on public.customers
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));
