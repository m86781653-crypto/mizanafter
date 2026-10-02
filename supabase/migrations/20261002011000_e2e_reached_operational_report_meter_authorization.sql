-- E2E-reached authorization repair.
-- The central operational report is SECURITY INVOKER and evaluates RLS as the
-- authenticated caller. The meters SELECT policy was still bound to the retired
-- public.get_user_project_id() helper, whose EXECUTE privilege is intentionally
-- revoked from browser roles. Keep the existing project scope and use the
-- current authorization kernel instead.
drop policy if exists sel_meters on public.meters;
create policy sel_meters on public.meters
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));
