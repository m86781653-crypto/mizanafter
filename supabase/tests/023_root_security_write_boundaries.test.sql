-- Security contract: project managers may not delete or mutate financial/measurement
-- records directly; browser roles cannot TRUNCATE structural application tables.
begin;
select plan(1);

do $$
declare v_project uuid := '2bee5204-050e-4fa6-8a85-36bbac986579';
begin
  perform set_config('request.jwt.claim.sub','512e9999-f00d-4b82-b6f1-5b4b1f779eb0',true);
  if private.mizan_can_write_project(v_project,'meter_readings','delete') then raise exception 'SECURITY_BOUNDARY_FAILED: meter reading delete'; end if;
  if private.mizan_can_write_project(v_project,'meter_readings','update') then raise exception 'SECURITY_BOUNDARY_FAILED: meter reading update'; end if;
  if private.mizan_can_write_project(v_project,'invoices','delete') then raise exception 'SECURITY_BOUNDARY_FAILED: invoice delete'; end if;
  if private.mizan_can_write_project(v_project,'invoices','update') then raise exception 'SECURITY_BOUNDARY_FAILED: invoice update'; end if;
  if private.mizan_can_write_project(v_project,'payments','delete') then raise exception 'SECURITY_BOUNDARY_FAILED: payment delete'; end if;
end $$;

do $$
declare v_bad integer;
begin
  select count(*) into v_bad from information_schema.role_table_grants
  where grantee in ('anon','authenticated') and table_schema='public'
    and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')
    and not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_depend d on d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e' join pg_extension e on e.oid=d.refobjid where n.nspname='public' and c.relname=information_schema.role_table_grants.table_name);
  if v_bad <> 0 then raise exception 'STRUCTURAL_CLIENT_GRANTS_REMAIN: %',v_bad; end if;
end $$;

select ok(true, 'root security write boundaries hold');
select * from finish();
rollback;
