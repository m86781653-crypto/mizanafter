revoke execute on function public.mizan_provision_subtenant_auto(
  uuid,text,text,text,text,text,text,numeric,text,text,integer,numeric,numeric,text,date,uuid,jsonb
) from public, anon, authenticated;

drop function if exists public.mizan_provision_subtenant_auto(
  uuid,text,text,text,text,text,text,numeric,text,text,integer,numeric,numeric,text,date,uuid,jsonb
);

create or replace function public.mizan_list_project_users(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_tenant uuid;
  v_users jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if private.mizan_user_role() <> 'central_governance'
     or not private.mizan_has_permission('governance.users.manage') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  v_actor_tenant := private.mizan_user_tenant_id();
  if not exists (
    select 1 from public.projects p
    join public.tenants t on t.id = p.tenant_id
    where p.id = p_project_id
      and p.status <> 'archived'
      and t.tenant_type = 'sub_tenant'
      and t.status = 'active'
      and t.parent_tenant_id = v_actor_tenant
  ) then raise exception 'FORBIDDEN_PROJECT_SCOPE' using errcode='42501'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id, 'email', p.email, 'full_name', p.full_name,
      'phone', p.phone, 'role', p.role, 'tenant_id', p.tenant_id,
      'project_id', p.project_id, 'must_change_password', p.must_change_password
    ) order by p.role
  ), '[]'::jsonb)
  into v_users
  from public.profiles p
  where p.project_id = p_project_id
    and p.role in ('project_manager','meter_reader','collection_officer','operations_maintenance');

  return jsonb_build_object('project_id', p_project_id, 'users', v_users);
end;
$function$;

revoke all on function public.mizan_list_project_users(uuid) from public, anon;
grant execute on function public.mizan_list_project_users(uuid) to authenticated;

create or replace function public.mizan_manage_project_user_profile(
  p_target_user_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_force_password_change boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_tenant uuid;
  v_target public.profiles%rowtype;
  v_project public.projects%rowtype;
  v_tenant public.tenants%rowtype;
  v_before jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if private.mizan_user_role() <> 'central_governance'
     or not private.mizan_has_permission('governance.users.manage') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_target_user_id is null then raise exception 'TARGET_USER_REQUIRED' using errcode='22023'; end if;

  v_actor_tenant := private.mizan_user_tenant_id();
  select * into v_target from public.profiles where id = p_target_user_id;
  if not found then raise exception 'TARGET_USER_NOT_FOUND' using errcode='P0002'; end if;
  if v_target.role not in ('project_manager','meter_reader','collection_officer','operations_maintenance') then
    raise exception 'TARGET_ROLE_FORBIDDEN' using errcode='42501';
  end if;

  select * into v_project from public.projects where id = v_target.project_id;
  if not found or v_project.status = 'archived' then raise exception 'FORBIDDEN_TARGET_SCOPE' using errcode='42501'; end if;
  select * into v_tenant from public.tenants where id = v_project.tenant_id;
  if not found or v_tenant.tenant_type <> 'sub_tenant' or v_tenant.status <> 'active'
     or v_tenant.parent_tenant_id <> v_actor_tenant or v_target.tenant_id <> v_tenant.id then
    raise exception 'FORBIDDEN_TARGET_SCOPE' using errcode='42501';
  end if;

  v_before := jsonb_build_object('full_name',v_target.full_name,'phone',v_target.phone,'must_change_password',v_target.must_change_password);

  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      phone = case when p_phone is null then phone else nullif(trim(p_phone), '') end,
      must_change_password = coalesce(p_force_password_change, must_change_password),
      updated_at = now()
  where id = p_target_user_id;

  select * into v_target from public.profiles where id = p_target_user_id;

  insert into public.audit_logs(
    table_name,record_id,action,user_id,actor_user_id,entity_type,entity_id,project_id,
    before_data,after_data,result,reason
  )
  values(
    'profiles',p_target_user_id,'UPDATE',auth.uid(),auth.uid(),'project_user_identity',
    p_target_user_id,v_target.project_id,v_before,
    jsonb_build_object('full_name',v_target.full_name,'phone',v_target.phone,'must_change_password',v_target.must_change_password),
    'success','central_governance_identity_profile_update'
  );

  return jsonb_build_object(
    'status','success','user_id',p_target_user_id,'full_name',v_target.full_name,
    'phone',v_target.phone,'must_change_password',v_target.must_change_password
  );
end;
$function$;

revoke all on function public.mizan_manage_project_user_profile(uuid,text,text,boolean) from public, anon;
grant execute on function public.mizan_manage_project_user_profile(uuid,text,text,boolean) to authenticated;
