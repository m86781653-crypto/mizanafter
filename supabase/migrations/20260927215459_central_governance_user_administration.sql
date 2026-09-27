-- Central governance user administration: identity management only.
-- This migration does not change tenant/project ownership and does not grant
-- central governance routine operational write permissions.

insert into public.mizan_permissions(permission_code,name_ar,description_ar)
values (
  'governance.users.manage',
  'إدارة حسابات المستخدمين',
  'إدارة هوية وحالة الحسابات التشغيلية للمشاريع التابعة للهيئة دون تغيير ارتباط المشروع أو المستأجر'
)
on conflict (permission_code) do update
set name_ar=excluded.name_ar, description_ar=excluded.description_ar;

insert into public.mizan_role_permissions(role_code,permission_code)
values ('central_governance','governance.users.manage')
on conflict do nothing;

drop policy if exists central_governance_project_users_read on public.profiles;

create policy central_governance_project_users_read
on public.profiles
for select
to authenticated
using (
  private.mizan_user_role() = 'central_governance'
  and private.mizan_has_permission('governance.users.manage')
  and project_id is not null
  and exists (
    select 1
    from public.projects p
    join public.tenants t on t.id = p.tenant_id
    where p.id = profiles.project_id
      and t.tenant_type = 'sub_tenant'
      and t.parent_tenant_id = private.mizan_user_tenant_id()
      and t.status = 'active'
      and p.tenant_id = profiles.tenant_id
  )
);

create or replace function private.mizan_can_manage_project_user(
  target_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  actor_tenant_id uuid;
begin
  if auth.uid() is null or target_user_id is null then
    return false;
  end if;

  if private.mizan_user_role() <> 'central_governance'
     or not private.mizan_has_permission('governance.users.manage') then
    return false;
  end if;

  actor_tenant_id := private.mizan_user_tenant_id();

  return exists (
    select 1
    from public.profiles target_profile
    join public.projects target_project
      on target_project.id = target_profile.project_id
     and target_project.tenant_id = target_profile.tenant_id
    join public.tenants target_tenant
      on target_tenant.id = target_project.tenant_id
    where target_profile.id = target_user_id
      and target_profile.role in ('project_manager','meter_reader','collection_officer')
      and target_tenant.tenant_type = 'sub_tenant'
      and target_tenant.parent_tenant_id = actor_tenant_id
      and target_tenant.status = 'active'
      and target_project.status <> 'archived'
  );
end
$function$;

revoke all on function private.mizan_can_manage_project_user(uuid) from public, anon, authenticated;

comment on function private.mizan_can_manage_project_user(uuid)
is 'Central identity-administration boundary. Does not grant operational project permissions and never changes tenant/project ownership.';
