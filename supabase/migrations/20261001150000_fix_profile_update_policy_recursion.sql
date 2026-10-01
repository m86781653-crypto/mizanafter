-- Fix recursive profiles UPDATE policy by resolving current profile state through
-- SECURITY DEFINER helpers instead of selecting public.profiles from its own policy.
create or replace function private.mizan_user_project_id()
returns uuid
language sql
stable
security definer
set search_path=''
as $function$
  select project_id from public.profiles where id=(select auth.uid())
$function$;

create or replace function private.mizan_user_must_change_password()
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select must_change_password from public.profiles where id=(select auth.uid())
$function$;

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
    and project_id is not distinct from private.mizan_user_project_id()
    and must_change_password is not distinct from private.mizan_user_must_change_password()
  )
);

revoke all on function private.mizan_user_project_id() from public,anon,authenticated;
revoke all on function private.mizan_user_must_change_password() from public,anon,authenticated;
grant execute on function private.mizan_user_project_id() to authenticated;
grant execute on function private.mizan_user_must_change_password() to authenticated;

revoke all on function private.mizan_clear_must_change_password(uuid) from public,anon;
grant execute on function private.mizan_clear_must_change_password(uuid) to authenticated;
