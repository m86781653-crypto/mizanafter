create or replace function private.mizan_validate_production_measurement_scope() returns trigger language plpgsql security definer set search_path to '' as $fn$
declare v_meter record;v_pump record;v_well record;
begin
select project_id,well_id,pump_id into v_meter from public.water_production_meters where id=new.production_meter_id;
if not found then raise exception 'PRODUCTION_METER_NOT_FOUND';end if;
if v_meter.project_id<>new.project_id or v_meter.well_id<>new.well_id or v_meter.pump_id<>new.pump_id then raise exception 'PRODUCTION_SCOPE_MISMATCH';end if;
select project_id,well_id into v_pump from public.pumps where id=new.pump_id;
if not found or v_pump.project_id<>new.project_id or v_pump.well_id<>new.well_id then raise exception 'PUMP_SCOPE_MISMATCH';end if;
select project_id into v_well from public.wells where id=new.well_id;
if not found or v_well.project_id<>new.project_id then raise exception 'WELL_SCOPE_MISMATCH';end if;
return new;end;$fn$;
drop trigger if exists trg_validate_production_reading_scope on public.water_production_readings;
create trigger trg_validate_production_reading_scope before insert or update on public.water_production_readings for each row execute function private.mizan_validate_production_measurement_scope();
drop trigger if exists trg_validate_production_cycle_scope on public.pump_operation_cycles;
create trigger trg_validate_production_cycle_scope before insert or update on public.pump_operation_cycles for each row execute function private.mizan_validate_production_measurement_scope();

create or replace function public.mizan_register_water_production_meter(p_project_id uuid,p_well_id uuid,p_pump_id uuid,p_meter_number text,p_serial_number text default null,p_initial_reading numeric default 0,p_installed_at date default null,p_notes text default null) returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_uid uuid:=auth.uid();v_id uuid;
begin
if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
if private.mizan_user_role()<>'project_manager' or not private.mizan_has_permission('project.manage') then raise exception 'PRODUCTION_METER_SETUP_FORBIDDEN' using errcode='42501';end if;
if not private.mizan_can_access_project(p_project_id) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501';end if;
if p_meter_number is null or nullif(trim(p_meter_number),'') is null then raise exception 'METER_NUMBER_REQUIRED' using errcode='22023';end if;
if p_initial_reading is null or p_initial_reading<0 then raise exception 'INITIAL_READING_INVALID' using errcode='22023';end if;
if not exists(select 1 from public.wells w where w.id=p_well_id and w.project_id=p_project_id) then raise exception 'WELL_SCOPE_INVALID' using errcode='22023';end if;
if not exists(select 1 from public.pumps p where p.id=p_pump_id and p.project_id=p_project_id and p.well_id=p_well_id) then raise exception 'PUMP_SCOPE_INVALID' using errcode='22023';end if;
insert into public.water_production_meters(project_id,well_id,pump_id,meter_number,serial_number,initial_reading,installed_at,notes)
values(p_project_id,p_well_id,p_pump_id,trim(p_meter_number),nullif(trim(p_serial_number),''),p_initial_reading,p_installed_at,nullif(trim(p_notes),'')) returning id into v_id;
return v_id;end;$fn$;
revoke execute on function public.mizan_register_water_production_meter(uuid,uuid,uuid,text,text,numeric,date,text) from public;
grant execute on function public.mizan_register_water_production_meter(uuid,uuid,uuid,text,text,numeric,date,text) to authenticated;

create or replace function public.mizan_capture_water_production_reading(p_production_meter_id uuid,p_reading_value numeric,p_captured_at timestamptz default now(),p_capture_phase text default 'check',p_image_url text default null,p_gps_lat numeric default null,p_gps_lng numeric default null,p_gps_accuracy numeric default null,p_notes text default null) returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_uid uuid:=auth.uid();v_meter public.water_production_meters%rowtype;v_id uuid;
begin
if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
if not private.mizan_has_permission('water.production.capture') then raise exception 'PRODUCTION_CAPTURE_FORBIDDEN' using errcode='42501';end if;
if p_reading_value is null or p_reading_value<0 then raise exception 'READING_VALUE_INVALID' using errcode='22023';end if;
if p_capture_phase not in('start','stop','check') then raise exception 'CAPTURE_PHASE_INVALID' using errcode='22023';end if;
select * into v_meter from public.water_production_meters where id=p_production_meter_id and status='active';
if not found then raise exception 'PRODUCTION_METER_NOT_FOUND' using errcode='22023';end if;
if not private.mizan_can_access_project(v_meter.project_id) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501';end if;
insert into public.water_production_readings(project_id,production_meter_id,well_id,pump_id,reading_value,captured_at,capture_phase,image_url,gps_lat,gps_lng,gps_accuracy,captured_by,notes)
values(v_meter.project_id,v_meter.id,v_meter.well_id,v_meter.pump_id,p_reading_value,coalesce(p_captured_at,now()),p_capture_phase,nullif(trim(p_image_url),''),p_gps_lat,p_gps_lng,p_gps_accuracy,v_uid,nullif(trim(p_notes),'')) returning id into v_id;
return v_id;end;$fn$;
revoke execute on function public.mizan_capture_water_production_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text) from public;
grant execute on function public.mizan_capture_water_production_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text) to authenticated;

create or replace function public.mizan_start_pump_operation_cycle(p_production_meter_id uuid,p_reading_id uuid,p_started_at timestamptz default now(),p_notes text default null) returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_uid uuid:=auth.uid();v_reading public.water_production_readings%rowtype;v_id uuid;
begin
if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
if not private.mizan_has_permission('water.production.capture') then raise exception 'PRODUCTION_CAPTURE_FORBIDDEN' using errcode='42501';end if;
select * into v_reading from public.water_production_readings where id=p_reading_id and production_meter_id=p_production_meter_id and capture_phase='start' and captured_by=v_uid and status='pending';
if not found then raise exception 'START_READING_INVALID' using errcode='22023';end if;
if not private.mizan_can_access_project(v_reading.project_id) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501';end if;
if exists(select 1 from public.pump_operation_cycles where project_id=v_reading.project_id and pump_id=v_reading.pump_id and status='running') then raise exception 'PUMP_ALREADY_RUNNING' using errcode='23505';end if;
insert into public.pump_operation_cycles(project_id,well_id,pump_id,production_meter_id,started_at,start_reading_id,started_by,notes)
values(v_reading.project_id,v_reading.well_id,v_reading.pump_id,v_reading.production_meter_id,coalesce(p_started_at,v_reading.captured_at),v_reading.id,v_uid,nullif(trim(p_notes),'')) returning id into v_id;
return v_id;end;$fn$;
revoke execute on function public.mizan_start_pump_operation_cycle(uuid,uuid,timestamptz,text) from public;
grant execute on function public.mizan_start_pump_operation_cycle(uuid,uuid,timestamptz,text) to authenticated;

create or replace function public.mizan_stop_pump_operation_cycle(p_cycle_id uuid,p_reading_id uuid,p_stopped_at timestamptz default now(),p_notes text default null) returns numeric language plpgsql security definer set search_path to '' as $fn$
declare v_uid uuid:=auth.uid();v_cycle public.pump_operation_cycles%rowtype;v_stop public.water_production_readings%rowtype;v_start public.water_production_readings%rowtype;v_production numeric;
begin
if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
if not private.mizan_has_permission('water.production.capture') then raise exception 'PRODUCTION_CAPTURE_FORBIDDEN' using errcode='42501';end if;
select * into v_cycle from public.pump_operation_cycles where id=p_cycle_id and status='running' for update;
if not found then raise exception 'RUNNING_CYCLE_NOT_FOUND' using errcode='22023';end if;
if not private.mizan_can_access_project(v_cycle.project_id) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501';end if;
select * into v_stop from public.water_production_readings where id=p_reading_id and production_meter_id=v_cycle.production_meter_id and pump_id=v_cycle.pump_id and capture_phase='stop' and captured_by=v_uid and status='pending';
if not found then raise exception 'STOP_READING_INVALID' using errcode='22023';end if;
select * into v_start from public.water_production_readings where id=v_cycle.start_reading_id;
if v_stop.reading_value<v_start.reading_value then raise exception 'METER_ROLLOVER_OR_INVALID_READING' using errcode='22023';end if;
if coalesce(p_stopped_at,v_stop.captured_at)<v_cycle.started_at then raise exception 'STOP_TIME_INVALID' using errcode='22023';end if;
v_production:=v_stop.reading_value-v_start.reading_value;
update public.pump_operation_cycles set stopped_at=coalesce(p_stopped_at,v_stop.captured_at),stop_reading_id=v_stop.id,production_m3=v_production,status='completed',stopped_by=v_uid,notes=coalesce(nullif(trim(p_notes),''),notes),updated_at=now() where id=v_cycle.id;
update public.water_production_readings set status='accepted' where id in(v_start.id,v_stop.id);
return v_production;end;$fn$;
revoke execute on function public.mizan_stop_pump_operation_cycle(uuid,uuid,timestamptz,text) from public;
grant execute on function public.mizan_stop_pump_operation_cycle(uuid,uuid,timestamptz,text) to authenticated;

create or replace view public.mizan_water_balance as
with production as(select project_id,started_at::date period_date,coalesce(sum(production_m3) filter(where status='completed'),0) production_m3 from public.pump_operation_cycles group by project_id,started_at::date),
consumption as(select project_id,reading_date::date period_date,coalesce(sum(consumption) filter(where quality_review_status='confirmed'),0) recorded_consumption_m3 from public.meter_readings group by project_id,reading_date::date),
periods as(select project_id,period_date from production union select project_id,period_date from consumption)
select p.project_id,p.period_date,coalesce(pr.production_m3,0) production_m3,coalesce(c.recorded_consumption_m3,0) recorded_consumption_m3,coalesce(pr.production_m3,0)-coalesce(c.recorded_consumption_m3,0) unaccounted_gap_m3
from periods p left join production pr using(project_id,period_date) left join consumption c using(project_id,period_date);
revoke all on public.mizan_water_balance from public;grant select on public.mizan_water_balance to authenticated;
comment on table public.water_production_meters is 'First-class cumulative production meter attached one-to-one to a project pump.';
comment on table public.water_production_readings is 'Field evidence observations of pump production-meter readings; separate from subscriber meter readings.';
comment on table public.pump_operation_cycles is 'Operational pump cycles bounded by start/stop production-meter observations.';
comment on view public.mizan_water_balance is 'Production and recorded subscriber consumption are exposed separately; the gap is not a final NRW determination until governed water-balance adjustments are applied.';