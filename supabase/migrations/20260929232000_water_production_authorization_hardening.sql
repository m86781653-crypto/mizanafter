drop policy if exists water_production_meters_select on public.water_production_meters;
create policy water_production_meters_select on public.water_production_meters for select to authenticated using(private.mizan_can_access_project(project_id) and private.mizan_has_permission('water.production.read'));
create or replace function public.mizan_capture_water_production_reading(p_production_meter_id uuid,p_reading_value numeric,p_captured_at timestamptz default now(),p_capture_phase text default 'check',p_image_url text default null,p_gps_lat numeric default null,p_gps_lng numeric default null,p_gps_accuracy numeric default null,p_notes text default null) returns uuid language plpgsql security definer set search_path to '' as $fn$
declare v_uid uuid:=auth.uid();v_meter public.water_production_meters%rowtype;v_id uuid;v_prefix text;
begin
if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
if not private.mizan_has_permission('water.production.capture') then raise exception 'PRODUCTION_CAPTURE_FORBIDDEN' using errcode='42501';end if;
if p_reading_value is null or p_reading_value<0 then raise exception 'READING_VALUE_INVALID' using errcode='22023';end if;
if p_capture_phase not in('start','stop','check') then raise exception 'CAPTURE_PHASE_INVALID' using errcode='22023';end if;
select * into v_meter from public.water_production_meters where id=p_production_meter_id and status='active';
if not found then raise exception 'PRODUCTION_METER_NOT_FOUND' using errcode='22023';end if;
if not private.mizan_can_access_project(v_meter.project_id) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501';end if;
if p_image_url is not null then
v_prefix:=v_meter.project_id::text||'/production/'||v_meter.id::text||'/';
if left(p_image_url,length(v_prefix))<>v_prefix then raise exception 'PRODUCTION_EVIDENCE_PATH_INVALID' using errcode='22023';end if;
end if;
insert into public.water_production_readings(project_id,production_meter_id,well_id,pump_id,reading_value,captured_at,capture_phase,image_url,gps_lat,gps_lng,gps_accuracy,captured_by,notes)
values(v_meter.project_id,v_meter.id,v_meter.well_id,v_meter.pump_id,p_reading_value,coalesce(p_captured_at,now()),p_capture_phase,nullif(trim(p_image_url),''),p_gps_lat,p_gps_lng,p_gps_accuracy,v_uid,nullif(trim(p_notes),'')) returning id into v_id;
return v_id;end;$fn$;
revoke execute on function public.mizan_capture_water_production_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text) from public;
grant execute on function public.mizan_capture_water_production_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text) to authenticated;
drop view if exists public.mizan_water_balance;
create view public.mizan_water_balance with (security_invoker=true) as
with production as(select project_id,started_at::date period_date,coalesce(sum(production_m3) filter(where status='completed'),0) production_m3 from public.pump_operation_cycles group by project_id,started_at::date),
consumption as(select project_id,reading_date::date period_date,coalesce(sum(consumption) filter(where quality_review_status='confirmed'),0) recorded_consumption_m3 from public.meter_readings group by project_id,reading_date::date),
periods as(select project_id,period_date from production union select project_id,period_date from consumption)
select p.project_id,p.period_date,coalesce(pr.production_m3,0) production_m3,coalesce(c.recorded_consumption_m3,0) recorded_consumption_m3,coalesce(pr.production_m3,0)-coalesce(c.recorded_consumption_m3,0) unaccounted_gap_m3
from periods p left join production pr using(project_id,period_date) left join consumption c using(project_id,period_date);
revoke all on public.mizan_water_balance from public;grant select on public.mizan_water_balance to authenticated;