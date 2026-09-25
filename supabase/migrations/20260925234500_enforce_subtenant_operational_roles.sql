-- Enforce one account per required operational role inside each tenant.
-- A sub-tenant is provisioned with exactly three roles:
-- tenant_manager, meter_reader, collection_officer.
create unique index if not exists profiles_required_role_per_tenant_uidx
  on public.profiles (tenant_id, role)
  where tenant_id is not null
    and role in ('tenant_manager', 'meter_reader', 'collection_officer');

comment on index public.profiles_required_role_per_tenant_uidx is
  'MIZAN tenant role invariant: at most one manager, meter reader, and collection officer per tenant; provisioning creates all three together.';
