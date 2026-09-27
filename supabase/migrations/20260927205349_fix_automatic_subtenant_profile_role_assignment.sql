-- Service-side profile role assignment is performed with no end-user subject
-- after central-governance authorization has completed in the parent provisioning call.
create or replace function public.mizan_provision_subtenant_auto(
  p_actor_user_id uuid,
  p_tenant_name_ar text,
  p_tenant_name_en text default null,
  p_project_name_ar text default null,
  p_project_name_en text default null,
  p_timezone text default 'Asia/Aden',
  p_funding_source text default null,
  p_funding_amount numeric default null,
  p_funding_currency text default null,
  p_donor text default null,
  p_beneficiary_count integer default 0,
  p_design_capacity numeric default 0,
  p_operational_capacity numeric default 0,
  p_address text default null,
  p_established_date date default null,
  p_district_id uuid default null,
  p_auth_users jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_auth jsonb;
  v_role text;
  v_email text;
  v_name text;
  v_user_id uuid;
  v_tenant_id uuid;
  v_project_id uuid;
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  if p_actor_user_id is null then
    raise exception 'ACTOR_REQUIRED' using errcode='22023';
  end if;
  if jsonb_typeof(p_auth_users) <> 'array' or jsonb_array_length(p_auth_users) <> 3 then
    raise exception 'EXACTLY_THREE_AUTH_USERS_REQUIRED' using errcode='22023';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);

  v_result := public.mizan_provision_subtenant(
    p_tenant_name_ar,p_tenant_name_en,p_project_name_ar,p_project_name_en,
    p_timezone,p_funding_source,p_funding_amount,p_funding_currency,p_donor,
    p_beneficiary_count,p_design_capacity,p_operational_capacity,p_address,
    p_established_date,p_district_id,
    (select jsonb_agg(jsonb_build_object(
      'role',u->>'role','full_name',u->>'full_name','email',lower(trim(u->>'email'))
    ) order by u->>'role') from jsonb_array_elements(p_auth_users) u)
  );

  v_tenant_id := (v_result->>'tenant_id')::uuid;
  v_project_id := (v_result->>'project_id')::uuid;

  perform set_config('request.jwt.claim.sub', '', true);

  for v_auth in select value from jsonb_array_elements(p_auth_users) loop
    v_role := trim(v_auth->>'role');
    v_email := lower(trim(v_auth->>'email'));
    v_name := nullif(trim(v_auth->>'full_name'), '');
    v_user_id := (v_auth->>'user_id')::uuid;

    if v_user_id is null or v_role not in ('project_manager','meter_reader','collection_officer')
       or v_email is null or v_name is null then
      raise exception 'INVALID_AUTH_USER_PAYLOAD' using errcode='22023';
    end if;

    if not exists (
      select 1 from auth.users au
      where au.id=v_user_id and lower(au.email)=v_email
    ) then
      raise exception 'AUTH_USER_MISMATCH' using errcode='22023';
    end if;

    insert into public.profiles(id,email,full_name,role,tenant_id,project_id,must_change_password)
    values(v_user_id,v_email,v_name,v_role,v_tenant_id,v_project_id,true)
    on conflict (id) do update set
      email=excluded.email,full_name=excluded.full_name,role=excluded.role,
      tenant_id=excluded.tenant_id,project_id=excluded.project_id,
      must_change_password=true;

    update private.subtenant_user_slots
       set status='claimed',claimed_user_id=v_user_id,claimed_at=now()
     where tenant_id=v_tenant_id and project_id=v_project_id
       and role=v_role and lower(email)=v_email and status='pending';
  end loop;

  return jsonb_build_object(
    'tenant_id',v_tenant_id,'project_id',v_project_id,
    'users',p_auth_users,'user_slots',coalesce(v_result->'user_slots','[]'::jsonb)
  );
end
$$;

revoke all on function public.mizan_provision_subtenant_auto(
  uuid,text,text,text,text,text,text,numeric,text,text,integer,numeric,numeric,text,date,uuid,jsonb
) from public,anon,authenticated;

grant execute on function public.mizan_provision_subtenant_auto(
  uuid,text,text,text,text,text,text,numeric,text,text,integer,numeric,numeric,text,date,uuid,jsonb
) to service_role;