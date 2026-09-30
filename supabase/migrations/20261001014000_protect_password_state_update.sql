-- Prevent project users from changing their own onboarding-completion state outside the governed password flow.
-- Platform administrators retain the existing administrative profile update path.
drop policy if exists update_own_profile on public.profiles;

create policy update_own_profile
on public.profiles
for update
to authenticated
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
    and not (project_id is distinct from (
      select p.project_id
      from public.profiles p
      where p.id = (select auth.uid())
    ))
    and must_change_password is not distinct from (
      select p.must_change_password
      from public.profiles p
      where p.id = (select auth.uid())
    )
  )
);
