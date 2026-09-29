insert into public.mizan_role_permissions(role_code,permission_code) values
('operations_maintenance','project.read'),('operations_maintenance','maintenance.manage'),('operations_maintenance','maintenance.execute'),('operations_maintenance','meter.exception') on conflict do nothing;

create or replace function public.mizan_provision_subtenant(
p_tenant_name_ar text,p_tenant_name_en text default null,p_project_name_ar text default null,p_project_name_en text default null,p_timezone text default 'Asia/Aden',
p_funding_source text default null,p_funding_amount numeric default null,p_funding_currency text default null,p_donor text default null,p_beneficiary_count integer default 0,p_design_capacity numeric default 0,p_operational_capacity numeric default 0,p_address text default null,p_established_date date default null,p_district_id uuid default null,p_users jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare v_caller_tenant uuid;v_tenant_id uuid;v_project_id uuid;v_user jsonb;v_role text;v_name text;v_email text;v_token text;v_slots jsonb:='[]'::jsonb;
begin
if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;v_caller_tenant:=private.mizan_user_tenant_id();
if private.mizan_user_role()<>'central_governance' or not private.mizan_has_permission('governance.tenant.manage') then raise exception 'SUBTENANT_PROVISION_FORBIDDEN' using errcode='42501';end if;
if not exists(select 1 from public.tenants where id=v_caller_tenant and tenant_type='main_tenant' and status='active') then raise exception 'MAIN_TENANT_REQUIRED' using errcode='42501';end if;
if nullif(trim(p_tenant_name_ar),'') is null or nullif(trim(p_project_name_ar),'') is null then raise exception 'TENANT_AND_PROJECT_NAMES_REQUIRED' using errcode='22023';end if;
if p_funding_amount is not null and p_funding_amount<0 then raise exception 'FUNDING_AMOUNT_INVALID' using errcode='22023';end if;
if coalesce(p_beneficiary_count,0)<0 or coalesce(p_design_capacity,0)<0 or coalesce(p_operational_capacity,0)<0 then raise exception 'PROJECT_NUMERIC_BASELINE_INVALID' using errcode='22023';end if;
if jsonb_typeof(p_users)<>'array' or jsonb_array_length(p_users)<>4 then raise exception 'EXACTLY_FOUR_USERS_REQUIRED' using errcode='22023';end if;
if exists(select 1 from jsonb_array_elements(p_users) u where coalesce(u->>'role','') not in('project_manager','meter_reader','collection_officer','operations_maintenance')) then raise exception 'INVALID_SUBTENANT_ROLE' using errcode='22023';end if;
if (select count(distinct u->>'role') from jsonb_array_elements(p_users) u)<>4 then raise exception 'FOUR_DISTINCT_ROLES_REQUIRED' using errcode='22023';end if;
if (select count(distinct lower(trim(u->>'email'))) from jsonb_array_elements(p_users) u)<>4 then raise exception 'USER_EMAILS_MUST_BE_DISTINCT' using errcode='22023';end if;
if exists(select 1 from public.tenants t where t.parent_tenant_id=v_caller_tenant and lower(trim(t.name_ar))=lower(trim(p_tenant_name_ar)) and t.status<>'archived') then raise exception 'TENANT_NAME_EXISTS' using errcode='23505';end if;
insert into public.tenants(parent_tenant_id,name_ar,name_en,tenant_type,timezone,status) values(v_caller_tenant,trim(p_tenant_name_ar),nullif(trim(p_tenant_name_en),''),'sub_tenant',coalesce(nullif(trim(p_timezone),''),'Asia/Aden'),'active') returning id into v_tenant_id;
insert into public.projects(name_ar,name_en,status,funding_source,funding_amount,funding_currency,donor,beneficiary_count,design_capacity,operational_capacity,address,established_date,district_id,tenant_id)
values(trim(p_project_name_ar),nullif(trim(p_project_name_en),''),'active',nullif(trim(p_funding_source),''),p_funding_amount,nullif(trim(p_funding_currency),''),nullif(trim(p_donor),''),coalesce(p_beneficiary_count,0),coalesce(p_design_capacity,0),coalesce(p_operational_capacity,0),nullif(trim(p_address),''),p_established_date,p_district_id,v_tenant_id) returning id into v_project_id;
for v_user in select value from jsonb_array_elements(p_users) loop
v_role:=trim(v_user->>'role');v_name:=nullif(trim(v_user->>'full_name'),'');v_email:=lower(nullif(trim(v_user->>'email'),''));
if v_name is null or v_email is null then raise exception 'USER_NAME_AND_EMAIL_REQUIRED' using errcode='22023';end if;
v_token:=encode(extensions.gen_random_bytes(32),'hex');
insert into private.subtenant_user_slots(tenant_id,project_id,role,full_name,email,token_hash) values(v_tenant_id,v_project_id,v_role,v_name,v_email,encode(extensions.digest(v_token,'sha256'),'hex'));
v_slots:=v_slots||jsonb_build_array(jsonb_build_object('role',v_role,'full_name',v_name,'email',v_email,'onboarding_token',v_token,'expires_at',now()+interval '72 hours'));
end loop;
insert into public.audit_logs(table_name,record_id,action,user_id,actor_user_id,entity_type,entity_id,new_values,result,reason)
values('tenants',v_tenant_id,'CREATE',auth.uid(),auth.uid(),'tenant',v_tenant_id,jsonb_build_object('parent_tenant_id',v_caller_tenant,'project_id',v_project_id,'tenant_type','sub_tenant','provisioned_roles',jsonb_build_array('project_manager','meter_reader','collection_officer','operations_maintenance')),'accepted','central_governance_provisioned_subtenant');
return jsonb_build_object('tenant_id',v_tenant_id,'project_id',v_project_id,'user_slots',v_slots);
end;$fn$;

create or replace function public.mizan_provision_subtenant_auto(
p_actor_user_id uuid,p_tenant_name_ar text,p_tenant_name_en text default null,p_project_name_ar text default null,p_project_name_en text default null,p_timezone text default 'Asia/Aden',
p_funding_source text default null,p_funding_amount numeric default null,p_funding_currency text default null,p_donor text default null,p_beneficiary_count integer default 0,p_design_capacity numeric default 0,p_operational_capacity numeric default 0,p_address text default null,p_established_date date default null,p_district_id uuid default null,p_auth_users jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $fn$
declare v_result jsonb;v_auth jsonb;v_role text;v_email text;v_name text;v_user_id uuid;v_tenant_id uuid;v_project_id uuid;
begin
if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
if p_actor_user_id is null then raise exception 'ACTOR_REQUIRED' using errcode='22023';end if;
if jsonb_typeof(p_auth_users)<>'array' or jsonb_array_length(p_auth_users)<>4 then raise exception 'EXACTLY_FOUR_AUTH_USERS_REQUIRED' using errcode='22023';end if;
perform set_config('request.jwt.claim.sub',p_actor_user_id::text,true);
v_result:=public.mizan_provision_subtenant(p_tenant_name_ar,p_tenant_name_en,p_project_name_ar,p_project_name_en,p_timezone,p_funding_source,p_funding_amount,p_funding_currency,p_donor,p_beneficiary_count,p_design_capacity,p_operational_capacity,p_address,p_established_date,p_district_id,(select jsonb_agg(jsonb_build_object('role',u->>'role','full_name',u->>'full_name','email',lower(trim(u->>'email'))) order by u->>'role') from jsonb_array_elements(p_auth_users) u));
v_tenant_id:=(v_result->>'tenant_id')::uuid;v_project_id:=(v_result->>'project_id')::uuid;perform set_config('request.jwt.claim.sub','',true);
for v_auth in select value from jsonb_array_elements(p_auth_users) loop
v_role:=trim(v_auth->>'role');v_email:=lower(trim(v_auth->>'email'));v_name:=nullif(trim(v_auth->>'full_name'),'');v_user_id:=(v_auth->>'user_id')::uuid;
if v_user_id is null or v_role not in('project_manager','meter_reader','collection_officer','operations_maintenance') or v_email is null or v_name is null then raise exception 'INVALID_AUTH_USER_PAYLOAD' using errcode='22023';end if;
if not exists(select 1 from auth.users au where au.id=v_user_id and lower(au.email)=v_email) then raise exception 'AUTH_USER_MISMATCH' using errcode='22023';end if;
insert into public.profiles(id,email,full_name,role,tenant_id,project_id,must_change_password) values(v_user_id,v_email,v_name,v_role,v_tenant_id,v_project_id,true)
on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,role=excluded.role,tenant_id=excluded.tenant_id,project_id=excluded.project_id,must_change_password=true;
update private.subtenant_user_slots set status='claimed',claimed_user_id=v_user_id,claimed_at=now() where tenant_id=v_tenant_id and project_id=v_project_id and role=v_role and lower(email)=v_email and status='pending';
end loop;
return jsonb_build_object('tenant_id',v_tenant_id,'project_id',v_project_id,'users',p_auth_users,'user_slots',coalesce(v_result->'user_slots','[]'::jsonb));
end;$fn$;