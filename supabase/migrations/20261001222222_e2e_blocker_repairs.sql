-- E2E-proven blocker repairs only.
-- No new business workflow or cycle model is introduced.

-- A) Current project authorization kernel must be used by the projects SELECT policy.
-- The legacy public.get_user_project_id() helper is intentionally not executable
-- by browser roles, so the old policy could never evaluate for authenticated clients.
drop policy if exists sel_projects on public.projects;
create policy sel_projects on public.projects
for select to authenticated
using (
  private.mizan_is_platform_admin()
  or private.mizan_can_access_project(id)
  or (
    private.mizan_user_role() = 'central_governance'
    and exists (
      select 1
      from public.tenants t
      where t.id = projects.tenant_id
        and t.tenant_type = 'sub_tenant'
        and t.status = 'active'
        and t.parent_tenant_id = private.mizan_user_tenant_id()
    )
  )
);

-- B) The actual passwordless/service-role-free onboarding contract stores the
-- token in auth.users.raw_user_meta_data through supabase.auth.signUp().
-- The trigger was incorrectly reading raw_app_meta_data, so it skipped the slot
-- claim and fell through without creating a profile.
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
  v_token := nullif(NEW.raw_user_meta_data->>'onboarding_token','');

  if v_token is not null then
    v_token_hash := encode(extensions.digest(v_token,'sha256'),'hex');

    select s.*
      into v_slot
    from private.subtenant_user_slots s
    where s.token_hash = v_token_hash
      and s.status = 'pending'
      and s.expires_at > now()
    for update;

    if not found then
      raise exception 'ONBOARDING_TOKEN_INVALID' using errcode='42501';
    end if;

    if lower(coalesce(NEW.email,'')) <> lower(v_slot.email) then
      raise exception 'ONBOARDING_EMAIL_MISMATCH' using errcode='42501';
    end if;

    insert into public.profiles(
      id,email,full_name,role,project_id,tenant_id,must_change_password
    )
    values(
      NEW.id,NEW.email,v_slot.full_name,v_slot.role,
      v_slot.project_id,v_slot.tenant_id,true
    )
    on conflict (id) do update set
      email=excluded.email,
      full_name=excluded.full_name,
      role=excluded.role,
      project_id=excluded.project_id,
      tenant_id=excluded.tenant_id,
      must_change_password=true,
      updated_at=now();

    update private.subtenant_user_slots
       set status='claimed',
           claimed_user_id=NEW.id,
           claimed_at=now()
     where id=v_slot.id;

    return NEW;
  end if;

  if coalesce(NEW.raw_user_meta_data->>'role','') in (
    'central_governance','project_manager','meter_reader','collection_officer',
    'tenant_manager','operations_officer','maintenance_officer','technician',
    'data_exception_officer','platform_admin','super_admin','collector',
    'maintenance_tech','operations_maintenance'
  ) then
    raise exception 'CONTROLLED_ROLE_PROVISIONING_REQUIRED' using errcode='42501';
  end if;

  return NEW;
end
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres;

-- C) profiles_role_check is the current canonical profile-role constraint.
-- profiles_role_allowed_chk is a stale duplicate created by the older role model
-- and drifted from the four-role provisioning contract. Remove the redundant
-- constraint so there is one authoritative role check.
alter table public.profiles
  drop constraint if exists profiles_role_allowed_chk;

-- D) Reached by the isolated E2E after A/B/C: wells SELECT still used the
-- revoked legacy get_user_project_id() helper.
drop policy if exists sel_wells on public.wells;
create policy sel_wells on public.wells
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));

-- E) Reached by the isolated E2E after wells: pumps SELECT still used the
-- revoked legacy get_user_project_id() helper.
drop policy if exists sel_pumps on public.pumps;
create policy sel_pumps on public.pumps
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));

-- F) Reached by isolated E2E after pumps: tanks SELECT still used the
-- revoked legacy get_user_project_id() helper.
drop policy if exists sel_tanks on public.tanks;
create policy sel_tanks on public.tanks
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));
