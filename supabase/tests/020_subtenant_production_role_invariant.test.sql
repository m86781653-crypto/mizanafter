-- Contract: every active sub-tenant must have at most one operational
-- account for each production provisioning role.
begin;
select plan(2);

do $$
begin
  if exists (
    select 1
    from public.profiles
    where tenant_id is not null
      and role in ('project_manager','meter_reader','collection_officer')
    group by tenant_id, role
    having count(*) > 1
  ) then
    raise exception 'SUBTENANT_OPERATIONAL_ROLE_DUPLICATES_EXIST';
  end if;
end
$$;

select ok(true, 'active sub-tenants do not contain duplicate operational roles');

select ok(
  exists (
    select 1
    from public.tenants t
    where t.tenant_type='main_tenant'
      and t.status='active'
  ),
  'an active main tenant exists'
);

select * from finish();
rollback;
