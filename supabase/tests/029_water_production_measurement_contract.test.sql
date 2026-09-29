begin;
select plan(1);

do $$
declare v_missing integer;
begin
  if not exists(select 1 from public.mizan_role_catalog where role_code='operations_maintenance' and not is_legacy) then raise exception 'OPERATIONS_MAINTENANCE_ROLE_MISSING'; end if;
  select count(*) into v_missing from (values
    ('water.production.capture'),('water.production.read'),('water.production.review')
  ) expected(permission_code)
  where not exists(select 1 from public.mizan_permissions p where p.permission_code=expected.permission_code);
  if v_missing<>0 then raise exception 'PRODUCTION_PERMISSIONS_MISSING: %',v_missing; end if;
  if not exists(select 1 from public.mizan_role_permissions where role_code='operations_maintenance' and permission_code='water.production.capture') then raise exception 'OPERATIONS_MAINTENANCE_CAPTURE_PERMISSION_MISSING'; end if;
  if not exists(select 1 from pg_class where oid='public.water_production_meters'::regclass and relrowsecurity) then raise exception 'PRODUCTION_METER_RLS_DISABLED'; end if;
  if not exists(select 1 from pg_class where oid='public.water_production_readings'::regclass and relrowsecurity) then raise exception 'PRODUCTION_READING_RLS_DISABLED'; end if;
  if not exists(select 1 from pg_class where oid='public.pump_operation_cycles'::regclass and relrowsecurity) then raise exception 'PRODUCTION_CYCLE_RLS_DISABLED'; end if;
  if has_table_privilege('authenticated','public.water_production_readings','INSERT') then raise exception 'PRODUCTION_READING_DIRECT_INSERT_EXPOSED'; end if;
  if has_table_privilege('authenticated','public.pump_operation_cycles','INSERT') then raise exception 'PRODUCTION_CYCLE_DIRECT_INSERT_EXPOSED'; end if;
  if has_table_privilege('authenticated','public.water_production_meters','INSERT') then raise exception 'PRODUCTION_METER_DIRECT_INSERT_EXPOSED'; end if;
  if to_regprocedure('public.mizan_capture_water_production_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text)') is null then raise exception 'PRODUCTION_CAPTURE_RPC_MISSING'; end if;
  if to_regprocedure('public.mizan_start_pump_operation_cycle(uuid,uuid,timestamptz,text)') is null then raise exception 'PRODUCTION_START_RPC_MISSING'; end if;
  if to_regprocedure('public.mizan_stop_pump_operation_cycle(uuid,uuid,timestamptz,text)') is null then raise exception 'PRODUCTION_STOP_RPC_MISSING'; end if;
  if to_regprocedure('public.mizan_register_water_production_meter(uuid,uuid,uuid,text,text,numeric,date,text)') is null then raise exception 'PRODUCTION_METER_SETUP_RPC_MISSING'; end if;
  if not exists(select 1 from pg_class where oid='public.mizan_water_balance'::regclass and 'security_invoker=true'=any(coalesce(reloptions,array[]::text[]))) then raise exception 'WATER_BALANCE_VIEW_SECURITY_INVOKER_MISSING'; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='water_production_readings' and cmd='SELECT')=0 then raise exception 'PRODUCTION_READING_SELECT_POLICY_MISSING'; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='pump_operation_cycles' and cmd='SELECT')=0 then raise exception 'PRODUCTION_CYCLE_SELECT_POLICY_MISSING'; end if;
end $$;

select ok(true,'water production authorization and lifecycle invariants hold');
select * from finish();
rollback;