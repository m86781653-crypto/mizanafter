-- MIZAN: production-grade service interruption tracking.
-- Applied to Supabase project dofteozulbjwnzofcfmo as service_interruptions_governance.
-- Reference repository remains read-only and untouched.

create table if not exists public.service_interruptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  interruption_number text not null,
  interruption_type text not null default 'service_stop'
    check (interruption_type in ('service_stop','pressure_drop','production_stop','planned_shutdown','emergency_shutdown')),
  severity text not null default 'medium'
    check (severity in ('low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','investigating','mitigating','restored','closed')),
  cause_category text,
  cause_description text,
  description text,
  started_at timestamptz not null default now(),
  restored_at timestamptz,
  closed_at timestamptz,
  affected_subscribers integer not null default 0 check (affected_subscribers >= 0),
  estimated_water_loss_m3 numeric not null default 0 check (estimated_water_loss_m3 >= 0),
  reported_by uuid references public.profiles(id),
  verified_by uuid references public.profiles(id),
  location geography(point,4326),
  evidence_url text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, interruption_number)
);

create index if not exists idx_service_interruptions_project_status on public.service_interruptions(project_id,status);
create index if not exists idx_service_interruptions_project_started on public.service_interruptions(project_id,started_at desc);
create index if not exists idx_service_interruptions_project_severity on public.service_interruptions(project_id,severity,status);

alter table public.service_interruptions enable row level security;
revoke all on public.service_interruptions from anon;
grant select,insert,update on public.service_interruptions to authenticated;

create policy "mizan_service_interruptions_select"
on public.service_interruptions for select to authenticated
using (private.mizan_can_access_project(project_id));

create policy "mizan_service_interruptions_insert"
on public.service_interruptions for insert to authenticated
with check (private.mizan_can_write_project(project_id,'service_interruptions','insert'));

create policy "mizan_service_interruptions_update"
on public.service_interruptions for update to authenticated
using (private.mizan_can_access_project(project_id))
with check (private.mizan_can_write_project(project_id,'service_interruptions','update'));

-- Extend the existing write authorization boundary for interruption records.
create or replace function private.mizan_can_write_project(
  target_project_id uuid, table_name text, operation text
) returns boolean
language plpgsql stable security definer set search_path=''
as $function$
declare
  role_code text;
  project_tenant_id uuid;
  user_tenant_id uuid;
begin
  select p.tenant_id into project_tenant_id from public.projects p where p.id=target_project_id;
  user_tenant_id := private.mizan_user_tenant_id();
  if project_tenant_id is null or user_tenant_id is null then return false; end if;
  if private.mizan_is_platform_admin() then return true; end if;
  if project_tenant_id <> user_tenant_id then return false; end if;
  if not private.mizan_can_access_project(target_project_id) then return false; end if;
  role_code := private.mizan_user_role();
  if operation='delete' then return role_code='tenant_manager'; end if;
  if table_name='service_interruptions' then
    return role_code in ('tenant_manager','operations_officer','maintenance_officer','technician')
      and (role_code <> 'technician' or operation='update');
  end if;
  if table_name in ('meter_readings','field_tasks') then
    return role_code in ('tenant_manager','operations_officer','meter_reader','data_exception_officer')
      and (operation='insert' or role_code in ('tenant_manager','operations_officer','data_exception_officer'));
  end if;
  if table_name='payments' then return role_code in ('tenant_manager','collection_officer'); end if;
  if table_name in ('invoices','tariffs','tariff_tiers') then return role_code in ('tenant_manager','operations_officer','data_exception_officer'); end if;
  if table_name in ('faults','maintenance_work_orders') then
    return role_code in ('tenant_manager','operations_officer','maintenance_officer','technician')
      and (role_code <> 'technician' or operation='update');
  end if;
  if table_name in ('assets','wells','pumps','tanks') then return role_code in ('tenant_manager','operations_officer','maintenance_officer'); end if;
  if table_name in ('customers','meters') then return role_code in ('tenant_manager','operations_officer','data_exception_officer'); end if;
  if table_name in ('notifications','kpi_snapshots') then return role_code in ('tenant_manager','operations_officer'); end if;
  if table_name in ('audit_logs','ai_logs') then return false; end if;
  return role_code in ('tenant_manager','operations_officer');
end;
$function$;
