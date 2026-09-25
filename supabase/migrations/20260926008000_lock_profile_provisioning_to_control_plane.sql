-- Profile provisioning is a control-plane operation.
-- Client roles must not create or reassign profiles; provisioning is performed by the
-- trusted Edge Functions (service role) and platform administration.
drop policy if exists insert_profile_admin on public.profiles;

drop policy if exists update_own_profile on public.profiles;
create policy update_own_profile on public.profiles
for update to authenticated
using (
  id = (select auth.uid())
  or private.mizan_is_platform_admin()
)
with check (
  private.mizan_is_platform_admin()
  or (
    id = (select auth.uid())
    and tenant_id = private.mizan_user_tenant_id()
    and role = private.mizan_user_role()
    and project_id is not distinct from (
      select p.project_id from public.profiles p where p.id = (select auth.uid())
    )
  )
);
