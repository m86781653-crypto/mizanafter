-- Close the archived/suspended project access path for tenant-scoped users.
-- Preserve the explicit platform-admin bypass and the central/subtenant relationship.
create or replace function private.mizan_can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
select coalesce(
  private.mizan_is_platform_admin()
  or exists (
    select 1
    from public.projects p
    join public.tenants t on t.id = p.tenant_id
    where p.id = target_project_id
      and p.tenant_id = private.mizan_user_tenant_id()
      and p.status = 'active'
      and t.status = 'active'
  )
  or exists (
    select 1
    from public.projects p
    join public.tenants t on t.id = p.tenant_id
    join public.tenants parent on parent.id = t.parent_tenant_id
    where p.id = target_project_id
      and p.status = 'active'
      and t.tenant_type = 'sub_tenant'
      and t.status = 'active'
      and parent.tenant_type = 'main_tenant'
      and parent.status = 'active'
      and parent.id = private.mizan_user_tenant_id()
  ),
  false
)
$$;
