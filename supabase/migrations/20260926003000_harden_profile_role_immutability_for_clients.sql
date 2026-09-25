-- MIZAN AI — Client profile role immutability
-- Profile provisioning and role changes are server-controlled. Authenticated
-- clients must not be able to create profiles or self-promote/change tenant scope.
drop policy if exists insert_profile_admin on public.profiles;

drop policy if exists update_own_profile on public.profiles;
create policy update_own_profile
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and tenant_id = private.mizan_user_tenant_id()
    and role = private.mizan_user_role()
  );
