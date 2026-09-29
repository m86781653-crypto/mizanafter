begin;
select plan(2);
do $$
begin
  if exists (select 1 from public.profiles where tenant_id is not null and role in ('project_manager','meter_reader','collection_officer','operations_maintenance') group by tenant_id,role having count(*)>1) then raise exception 'SUBTENANT_OPERATIONAL_ROLE_DUPLICATES_EXIST'; end if;
end $$;
select ok(true,'active sub-tenants do not contain duplicate operational roles');
select ok(exists(select 1 from information_schema.columns where table_schema='public' and table_name='tenants' and column_name='tenant_type') and exists(select 1 from information_schema.columns where table_schema='public' and table_name='tenants' and column_name='status'),'tenant control plane exposes tenant type and lifecycle status');
select * from finish(); rollback;