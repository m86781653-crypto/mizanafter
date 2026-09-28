-- Root security hardening: granular write boundaries and removal of client-only
-- structural privileges that bypass RLS (notably TRUNCATE).
--
-- Operational pages that legitimately use direct DML remain protected by
-- table-specific RLS plus this permission kernel. Financial and measurement
-- records are intentionally immutable through direct client DML.

create or replace function private.mizan_can_write_project(
  target_project_id uuid,
  table_name text,
  operation text
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  role_code text;
begin
  if target_project_id is null or private.mizan_user_tenant_id() is null then
    return false;
  end if;

  if private.mizan_is_platform_admin() then
    return true;
  end if;

  if not private.mizan_can_access_project(target_project_id) then
    return false;
  end if;

  role_code := private.mizan_user_role();

  if role_code = 'central_governance' then
    return false;
  end if;

  -- Financial and measurement separation of duties.
  if table_name = 'meter_readings' then
    return operation = 'insert'
      and private.mizan_has_permission('meter.capture');
  end if;

  if table_name = 'payments' then
    if operation = 'insert' then
      return private.mizan_has_permission('collection.record');
    end if;
    if operation = 'update' then
      return private.mizan_has_permission('collection.approve');
    end if;
    return false;
  end if;

  -- Invoices are system-generated from governed readings. Direct client
  -- UPDATE/DELETE would break auditability and calculation lineage.
  if table_name = 'invoices' then
    if operation = 'select' then
      return private.mizan_has_permission('project.read');
    end if;
    return false;
  end if;

  if table_name in ('tariffs','tariff_tiers') then
    return operation in ('insert','update')
      and private.mizan_has_permission('billing.manage');
  end if;

  if table_name in ('customers','meters') then
    if operation in ('insert','update') then
      return private.mizan_has_permission('customer.manage');
    end if;
    if operation = 'delete' then
      return private.mizan_has_permission('customer.manage')
        and role_code = 'project_manager';
    end if;
    return false;
  end if;

  if table_name in ('faults','maintenance_work_orders','service_interruptions') then
    if operation in ('insert','update') then
      return private.mizan_has_permission('maintenance.manage')
        or private.mizan_has_permission('maintenance.execute');
    end if;
    return false;
  end if;

  if table_name in ('assets','wells','pumps','tanks') then
    if operation in ('insert','update') then
      return private.mizan_has_permission('project.manage');
    end if;
    return false;
  end if;

  if table_name in ('notifications','kpi_snapshots') then
    return operation in ('insert','update')
      and role_code = 'project_manager';
  end if;

  -- Audit/AI logs are system-owned and must never be client-written.
  if table_name in ('audit_logs','ai_logs') then
    return false;
  end if;

  return operation in ('insert','update')
    and private.mizan_has_permission('project.manage');
end;
$function$;

-- RLS never protects TRUNCATE, TRIGGER, or REFERENCES. These are not
-- application privileges and must not be granted to browser roles.
do $$
declare
  r record;
begin
  for r in
    select distinct table_schema, table_name
    from information_schema.role_table_grants
    where grantee in ('anon','authenticated')
      and table_schema = 'public'
      and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')
  loop
    execute format(
      'revoke truncate, trigger, references on table %I.%I from anon, authenticated',
      r.table_schema, r.table_name
    );
  end loop;
end $$;

-- Security/control-plane tables are never directly writable by browser
-- sessions. Their server-side governed functions retain service access.
revoke insert, update, delete, truncate, trigger, references
on table public.mizan_role_catalog, public.mizan_role_permissions,
         public.seq_counters, public.project_seq_counters
from anon, authenticated;

revoke insert, update, delete, truncate, trigger, references
on table public.ai_logs, public.audit_logs
from anon, authenticated;

-- Tenant control-plane changes are performed through governed functions.
revoke insert, update, delete
on table public.tenants
from anon, authenticated;

-- Public catalog PostGIS object is never an application data surface.
revoke all on table public.spatial_ref_sys from anon, authenticated;

revoke all on function private.mizan_can_write_project(uuid,text,text)
from public, anon, authenticated;
grant execute on function private.mizan_can_write_project(uuid,text,text)
to authenticated, service_role;
