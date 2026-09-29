-- Production contract: sub-tenant project/profile tenancy must be internally consistent.
begin;
select plan(1);

do $$
begin
  if exists (
    select 1 from public.profiles p join public.projects pr on pr.id = p.project_id
    where p.tenant_id is distinct from pr.tenant_id
  ) then raise exception 'PROFILE_PROJECT_TENANT_MISMATCH'; end if;
  if exists (
    select 1 from public.projects pr join public.tenants t on t.id = pr.tenant_id
    where t.tenant_type = 'sub_tenant' and t.status = 'active' and pr.tenant_id is null
  ) then raise exception 'ACTIVE_SUBTENANT_PROJECT_MISSING_TENANT'; end if;
  if exists (
    select 1 from public.profiles p join public.tenants t on t.id = p.tenant_id
    where p.role in ('project_manager','meter_reader','collection_officer')
      and (t.tenant_type <> 'sub_tenant' or t.status <> 'active')
  ) then raise exception 'OPERATIONAL_PROFILE_OUTSIDE_ACTIVE_SUBTENANT'; end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname in ('assets','customers','faults','field_tasks','invoices','kpi_snapshots','maintenance_work_orders','meter_readings','meters','notifications','payments','pumps','service_interruptions','tanks','tariffs','wells')
      and not c.relrowsecurity
  ) then raise exception 'PROJECT_OPERATIONAL_TABLE_RLS_DISABLED'; end if;
end
$$;

select ok(true, 'sub-tenant production tenancy and RLS invariants hold');
select * from finish();
rollback;
