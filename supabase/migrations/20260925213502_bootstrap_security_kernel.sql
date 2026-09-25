-- Bootstrap the private authorization/audit kernel after tenant governance.
create schema if not exists private;

create or replace function private.mizan_user_tenant_id()
returns uuid language sql stable security definer set search_path=''
as $$ select tenant_id from public.profiles where id=(select auth.uid()) $$;

create or replace function private.mizan_user_role()
returns text language sql stable security definer set search_path=''
as $$
select case when p.role='super_admin' then 'platform_admin'
when p.role='project_manager' then 'tenant_manager'
when p.role='collector' then 'collection_officer'
when p.role='maintenance_tech' then 'technician'
when p.role='read_only' then 'viewer' else p.role end
from public.profiles p where p.id=(select auth.uid())
$$;

create or replace function private.mizan_is_platform_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce((select private.mizan_user_role() in ('platform_admin')),false) $$;

create or replace function private.mizan_has_permission(permission_code text)
returns boolean language sql stable security definer set search_path=''
as $$
select coalesce(exists(select 1 from public.mizan_role_permissions rp
where rp.role_code=private.mizan_user_role() and rp.permission_code=permission_code),false)
$$;

create or replace function private.mizan_can_access_project(target_project_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
select coalesce(private.mizan_is_platform_admin()
or exists(select 1 from public.projects p where p.id=target_project_id and p.tenant_id=private.mizan_user_tenant_id() and p.tenant_id is not null)
or exists(select 1 from public.projects p join public.tenants t on t.id=p.tenant_id join public.tenants parent on parent.id=t.parent_tenant_id
where p.id=target_project_id and t.tenant_type='sub_tenant' and t.status='active'
and parent.tenant_type='main_tenant' and parent.status='active' and parent.id=private.mizan_user_tenant_id()),false)
$$;

create or replace function private.mizan_can_write_project(target_project_id uuid,table_name text,operation text)
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare role_code text; project_tenant_id uuid; user_tenant_id uuid;
begin
select p.tenant_id into project_tenant_id from public.projects p where p.id=target_project_id;
user_tenant_id:=private.mizan_user_tenant_id();
if project_tenant_id is null or user_tenant_id is null then return false; end if;
if private.mizan_is_platform_admin() then return true; end if;
if project_tenant_id<>user_tenant_id then return false; end if;
if not private.mizan_can_access_project(target_project_id) then return false; end if;
role_code:=private.mizan_user_role();
if operation='delete' then return role_code='tenant_manager'; end if;
if table_name='service_interruptions' then return role_code in ('tenant_manager','operations_officer','maintenance_officer','technician') and (role_code<>'technician' or operation='update'); end if;
if table_name in ('meter_readings','field_tasks') then return role_code in ('tenant_manager','operations_officer','meter_reader','data_exception_officer') and (operation='insert' or role_code in ('tenant_manager','operations_officer','data_exception_officer')); end if;
if table_name='payments' then return role_code in ('tenant_manager','collection_officer'); end if;
if table_name in ('invoices','tariffs','tariff_tiers') then return role_code in ('tenant_manager','operations_officer','data_exception_officer'); end if;
if table_name in ('faults','maintenance_work_orders') then return role_code in ('tenant_manager','operations_officer','maintenance_officer','technician') and (role_code<>'technician' or operation='update'); end if;
if table_name in ('assets','wells','pumps','tanks') then return role_code in ('tenant_manager','operations_officer','maintenance_officer'); end if;
if table_name in ('customers','meters') then return role_code in ('tenant_manager','operations_officer','data_exception_officer'); end if;
if table_name in ('notifications','kpi_snapshots') then return role_code in ('tenant_manager','operations_officer'); end if;
if table_name in ('audit_logs','ai_logs') then return false; end if;
return role_code in ('tenant_manager','operations_officer');
end
$$;

create or replace function private.mizan_touch_updated_at()
returns trigger language plpgsql security invoker set search_path=''
as $$ begin new.updated_at=now(); return new; end $$;

create or replace function private.mizan_write_audit(p_project_id uuid,p_action text,p_entity_type text,p_entity_id uuid default null,p_before_data jsonb default null,p_after_data jsonb default null,p_reason text default null,p_result text default 'success')
returns uuid language plpgsql security definer set search_path=''
as $$
declare new_event_id uuid; actor uuid:=(select auth.uid()); actor_name text;
begin
select full_name into actor_name from public.profiles where id=actor;
insert into public.audit_logs(event_id,table_name,record_id,action,old_values,new_values,user_id,user_name,actor_user_id,project_id,entity_type,entity_id,before_data,after_data,reason,result)
values(gen_random_uuid(),p_entity_type,p_entity_id,p_action,p_before_data,p_after_data,actor,actor_name,actor,p_project_id,p_entity_type,p_entity_id,p_before_data,p_after_data,p_reason,p_result)
returning event_id into new_event_id;
return new_event_id;
end
$$;

create or replace function private.mizan_audit_row_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_project_id uuid; v_entity_id uuid; v_before jsonb; v_after jsonb;
begin
if tg_op='DELETE' then v_project_id:=nullif(to_jsonb(old)->>'project_id','')::uuid; v_entity_id:=nullif(to_jsonb(old)->>'id','')::uuid; v_before:=to_jsonb(old);
else v_project_id:=nullif(to_jsonb(new)->>'project_id','')::uuid; v_entity_id:=nullif(to_jsonb(new)->>'id','')::uuid; v_after:=to_jsonb(new); if tg_op='UPDATE' then v_before:=to_jsonb(old); end if; end if;
perform private.mizan_write_audit(v_project_id,'row_'||lower(tg_op),tg_table_name,v_entity_id,v_before,v_after,null,'success');
return coalesce(new,old);
end
$$;

create or replace function private.mizan_block_audit_mutation()
returns trigger language plpgsql security definer set search_path=''
as $$ begin raise exception 'AUDIT_LOG_IMMUTABLE'; end $$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path='public'
as $$ select coalesce(private.mizan_is_platform_admin(),false) $$;

revoke all on schema private from public,anon,authenticated;
grant usage on schema private to service_role;
