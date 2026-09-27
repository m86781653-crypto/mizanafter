-- Contract: every active sub-tenant must have at most one operational
-- account for each production provisioning role.
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

  if exists (
    select 1
    from public.projects p
    join public.tenants t on t.id=p.tenant_id
    where p.tenant_id is null
       or t.tenant_type <> 'sub_tenant'
       or t.status='archived'
  ) then
    -- Projects outside a sub-tenant are allowed for legacy/main data only when
    -- explicitly governed; this contract does not fail those records.
    null;
  end if;

  if not exists (
    select 1
    from public.tenants t
    where t.tenant_type='main_tenant'
      and t.status='active'
  ) then
    raise exception 'ACTIVE_MAIN_TENANT_MISSING';
  end if;
end
$$;
