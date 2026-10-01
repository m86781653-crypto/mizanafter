-- Reached E2E blocker only: wells SELECT policy still used the revoked
-- legacy public.get_user_project_id() helper.
-- Keep the existing authorization model and use the current private project kernel.
drop policy if exists sel_wells on public.wells;
create policy sel_wells on public.wells
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));
