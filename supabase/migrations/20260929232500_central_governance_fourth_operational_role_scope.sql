create or replace function private.mizan_can_manage_project_user(target_user_id uuid) returns boolean language plpgsql stable security definer set search_path to '' as $fn$
declare actor_tenant_id uuid;
begin
if auth.uid() is null or target_user_id is null then return false;end if;
if private.mizan_user_role()<>'central_governance' or not private.mizan_has_permission('governance.users.manage') then return false;end if;
actor_tenant_id:=private.mizan_user_tenant_id();
return exists(select 1 from public.profiles target_profile join public.projects target_project on target_project.id=target_profile.project_id and target_project.tenant_id=target_profile.tenant_id join public.tenants target_tenant on target_tenant.id=target_project.tenant_id where target_profile.id=target_user_id and target_profile.role in('project_manager','meter_reader','collection_officer','operations_maintenance') and target_tenant.tenant_type='sub_tenant' and target_tenant.parent_tenant_id=actor_tenant_id and target_tenant.status='active' and target_project.status<>'archived');
end;$fn$;