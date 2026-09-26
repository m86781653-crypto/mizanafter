create schema if not exists private;

create table if not exists private.subtenant_user_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('project_manager','meter_reader','collection_officer')),
  full_name text not null,
  email text not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','claimed','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '72 hours'),
  claimed_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, role),
  unique (tenant_id, email)
);

create index if not exists subtenant_user_slots_project_idx
  on private.subtenant_user_slots(project_id, status);

alter table public.projects
  add column if not exists funding_amount numeric(18,2),
  add column if not exists funding_currency text,
  add column if not exists funding_notes text;

create or replace function public.mizan_provision_subtenant(
  p_tenant_name_ar text,
  p_tenant_name_en text default null,
  p_project_name_ar text default null,
  p_project_name_en text default null,
  p_timezone text default 'Asia/Aden',
  p_funding_source text default null,
  p_funding_amount numeric default null,
  p_funding_currency text default null,
  p_users jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_caller_tenant uuid;
  v_tenant_id uuid;
  v_project_id uuid;
  v_user jsonb;
  v_role text;
  v_name text;
  v_email text;
  v_token text;
  v_slots jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  v_caller_tenant := private.mizan_user_tenant_id();

  if private.mizan_user_role() <> 'central_governance'
     or not private.mizan_has_permission('governance.tenant.manage') then
    raise exception 'SUBTENANT_PROVISION_FORBIDDEN' using errcode='42501';
  end if;

  if not exists (
    select 1 from public.tenants
    where id = v_caller_tenant and tenant_type='main_tenant' and status='active'
  ) then
    raise exception 'MAIN_TENANT_REQUIRED' using errcode='42501';
  end if;

  if nullif(trim(p_tenant_name_ar),'') is null
     or nullif(trim(p_project_name_ar),'') is null then
    raise exception 'TENANT_AND_PROJECT_NAMES_REQUIRED' using errcode='22023';
  end if;

  if p_funding_amount is not null and p_funding_amount < 0 then
    raise exception 'FUNDING_AMOUNT_INVALID' using errcode='22023';
  end if;

  if jsonb_typeof(p_users) <> 'array' or jsonb_array_length(p_users) <> 3 then
    raise exception 'EXACTLY_THREE_USERS_REQUIRED' using errcode='22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_users) u
    where coalesce(u->>'role','') not in ('project_manager','meter_reader','collection_officer')
  ) then
    raise exception 'INVALID_SUBTENANT_ROLE' using errcode='22023';
  end if;

  if (
    select count(distinct u->>'role')
    from jsonb_array_elements(p_users) u
  ) <> 3 then
    raise exception 'THREE_DISTINCT_ROLES_REQUIRED' using errcode='22023';
  end if;

  if (
    select count(distinct lower(trim(u->>'email')))
    from jsonb_array_elements(p_users) u
  ) <> 3 then
    raise exception 'USER_EMAILS_MUST_BE_DISTINCT' using errcode='22023';
  end if;

  if exists (
    select 1
    from public.tenants t
    where t.parent_tenant_id=v_caller_tenant
      and lower(trim(t.name_ar))=lower(trim(p_tenant_name_ar))
      and t.status <> 'archived'
  ) then
    raise exception 'TENANT_NAME_EXISTS' using errcode='23505';
  end if;

  insert into public.tenants(parent_tenant_id,name_ar,name_en,tenant_type,timezone,status)
  values (
    v_caller_tenant, trim(p_tenant_name_ar), nullif(trim(p_tenant_name_en),''),
    'sub_tenant', coalesce(nullif(trim(p_timezone),''),'Asia/Aden'), 'active'
  )
  returning id into v_tenant_id;

  insert into public.projects(
    name_ar,name_en,status,funding_source,funding_amount,funding_currency,funding_notes,tenant_id
  )
  values (
    trim(p_project_name_ar), nullif(trim(p_project_name_en),''), 'active',
    nullif(trim(p_funding_source),''), p_funding_amount,
    nullif(trim(p_funding_currency),''), null, v_tenant_id
  )
  returning id into v_project_id;

  for v_user in select value from jsonb_array_elements(p_users)
  loop
    v_role := trim(v_user->>'role');
    v_name := nullif(trim(v_user->>'full_name'),'');
    v_email := lower(nullif(trim(v_user->>'email'),''));

    if v_name is null or v_email is null then
      raise exception 'USER_NAME_AND_EMAIL_REQUIRED' using errcode='22023';
    end if;

    v_token := encode(gen_random_bytes(32), 'hex');

    insert into private.subtenant_user_slots(
      tenant_id,project_id,role,full_name,email,token_hash
    )
    values (
      v_tenant_id,v_project_id,v_role,v_name,v_email,
      encode(digest(v_token,'sha256'),'hex')
    );

    v_slots := v_slots || jsonb_build_array(jsonb_build_object(
      'role', v_role,
      'full_name', v_name,
      'email', v_email,
      'onboarding_token', v_token,
      'expires_at', now() + interval '72 hours'
    ));
  end loop;

  insert into public.audit_logs(
    table_name,record_id,action,user_id,actor_user_id,entity_type,entity_id,
    new_values,result,reason
  )
  values(
    'tenants',v_tenant_id,'CREATE',auth.uid(),auth.uid(),'tenant',v_tenant_id,
    jsonb_build_object(
      'parent_tenant_id',v_caller_tenant,
      'project_id',v_project_id,
      'tenant_type','sub_tenant',
      'provisioned_roles',jsonb_build_array('project_manager','meter_reader','collection_officer')
    ),
    'accepted','central_governance_provisioned_subtenant'
  );

  return jsonb_build_object(
    'tenant_id',v_tenant_id,
    'project_id',v_project_id,
    'user_slots',v_slots
  );
end
$function$;

revoke all on function public.mizan_provision_subtenant(text,text,text,text,text,text,numeric,text,jsonb) from public, anon;
grant execute on function public.mizan_provision_subtenant(text,text,text,text,text,text,numeric,text,jsonb) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_token text;
  v_token_hash text;
  v_slot record;
begin
  v_token := nullif(NEW.raw_app_meta_data->>'onboarding_token','');

  if v_token is not null then
    v_token_hash := encode(digest(v_token,'sha256'),'hex');

    select s.*
      into v_slot
    from private.subtenant_user_slots s
    where s.token_hash = v_token_hash
      and s.status = 'pending'
      and s.expires_at > now()
    for update;

    if not found then raise exception 'ONBOARDING_TOKEN_INVALID' using errcode='42501'; end if;
    if lower(coalesce(NEW.email,'')) <> lower(v_slot.email) then raise exception 'ONBOARDING_EMAIL_MISMATCH' using errcode='42501'; end if;
    if coalesce(NEW.raw_app_meta_data->>'role','') <> v_slot.role
       or coalesce(NEW.raw_app_meta_data->>'tenant_id','') <> v_slot.tenant_id::text
       or coalesce(NEW.raw_app_meta_data->>'project_id','') <> v_slot.project_id::text
    then raise exception 'ONBOARDING_SCOPE_MISMATCH' using errcode='42501'; end if;

    insert into public.profiles(id,email,full_name,role,project_id,tenant_id,must_change_password)
    values(NEW.id,NEW.email,v_slot.full_name,v_slot.role,v_slot.project_id,v_slot.tenant_id,true)
    on conflict (id) do update set
      email=excluded.email,full_name=excluded.full_name,role=excluded.role,
      project_id=excluded.project_id,tenant_id=excluded.tenant_id,
      must_change_password=true,updated_at=now();

    update private.subtenant_user_slots
    set status='claimed',claimed_user_id=NEW.id,claimed_at=now()
    where id=v_slot.id;
    return NEW;
  end if;

  if coalesce(NEW.raw_app_meta_data->>'role','') in (
    'central_governance','project_manager','meter_reader','collection_officer',
    'tenant_manager','operations_officer','maintenance_officer','technician',
    'data_exception_officer','platform_admin','super_admin','collector','maintenance_tech'
  ) then
    raise exception 'CONTROLLED_ROLE_PROVISIONING_REQUIRED' using errcode='42501';
  end if;

  return NEW;
end
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres;
