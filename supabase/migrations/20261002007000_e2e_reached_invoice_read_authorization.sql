-- E2E-reached authorization repair.
-- The invoice SELECT policy was still bound to the retired public.get_user_project_id()
-- helper. Use the current project authorization kernel instead.
drop policy if exists sel_invoices on public.invoices;
create policy sel_invoices on public.invoices
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));
