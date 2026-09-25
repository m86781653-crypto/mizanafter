-- Keep project UPDATE authorization inside the RLS kernel.
-- Do not depend on an externally callable permission helper for policy evaluation.
drop policy if exists upd_projects on public.projects;
create policy upd_projects on public.projects
for update to authenticated
using (private.mizan_can_access_project(id))
with check (
  private.mizan_can_access_project(id)
  and (private.mizan_is_platform_admin() or private.mizan_user_role() = 'tenant_manager')
);
