-- Align the tenant-level operational role invariant with the actual production
-- provisioning contract: project_manager, meter_reader, collection_officer.
drop index if exists public.profiles_required_role_per_tenant_uidx;

create unique index if not exists profiles_required_role_per_tenant_uidx
  on public.profiles (tenant_id, role)
  where tenant_id is not null
    and role in ('project_manager', 'meter_reader', 'collection_officer');

comment on index public.profiles_required_role_per_tenant_uidx is
  'MIZAN sub-tenant invariant: at most one project manager, meter reader, and collection officer per sub-tenant.';
