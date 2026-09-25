-- Govern profile roles and remove legacy role assumptions.
alter table public.profiles drop constraint if exists profiles_role_allowed_chk;
alter table public.profiles add constraint profiles_role_allowed_chk
check (role in (
  'platform_admin',
  'tenant_manager',
  'operations_officer',
  'meter_reader',
  'collection_officer',
  'maintenance_officer',
  'technician',
  'data_exception_officer',
  'viewer'
));

drop policy if exists insert_profile_admin on public.profiles;
create policy insert_profile_admin on public.profiles
for insert to authenticated
with check (
  private.mizan_is_platform_admin()
  or (
    private.mizan_user_role() = 'tenant_manager'
    and tenant_id = private.mizan_user_tenant_id()
    and role in (
      'tenant_manager',
      'meter_reader',
      'collection_officer',
      'operations_officer',
      'maintenance_officer',
      'technician',
      'data_exception_officer',
      'viewer'
    )
  )
);

drop policy if exists update_own_profile on public.profiles;
create policy update_own_profile on public.profiles
for update to authenticated
using (
  id = auth.uid()
  or private.mizan_is_platform_admin()
  or (
    private.mizan_user_role() = 'tenant_manager'
    and tenant_id = private.mizan_user_tenant_id()
  )
)
with check (
  private.mizan_is_platform_admin()
  or (
    id = auth.uid()
    and tenant_id = private.mizan_user_tenant_id()
    and role = private.mizan_user_role()
  )
  or (
    private.mizan_user_role() = 'tenant_manager'
    and tenant_id = private.mizan_user_tenant_id()
    and role in (
      'tenant_manager',
      'meter_reader',
      'collection_officer',
      'operations_officer',
      'maintenance_officer',
      'technician',
      'data_exception_officer',
      'viewer'
    )
  )
);
