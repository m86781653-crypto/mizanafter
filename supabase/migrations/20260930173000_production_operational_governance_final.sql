-- Production operational governance: separate maintenance reports from real interruptions,
-- link interruption evidence to production measurements, derive impact metrics, and close direct browser write paths.

alter table public.faults
  add column if not exists causes_service_interruption boolean not null default false,
  add column if not exists interruption_id uuid;

alter table public.service_interruptions
  add column if not exists fault_id uuid,
  add column if not exists asset_id uuid,
  add column if not exists well_id uuid,
  add column if not exists pump_id uuid,
  add column if not exists production_meter_id uuid,
  add column if not exists stop_reading_id uuid,
  add column if not exists restart_reading_id uuid,
  add column if not exists interruption_class text,
  add column if not exists reported_at timestamptz not null default now(),
  add column if not exists started_at_source text not null default 'reported',
  add column if not exists start_time_reason text,
  add column if not exists start_time_recorded_at timestamptz,
  add column if not exists start_time_recorded_by uuid,
  add column if not exists restored_by uuid,
  add column if not exists potentially_affected_production_m3 numeric,
  add column if not exists coverage_benchmark_lpd numeric,
  add column if not exists coverage_equivalent_person_days numeric;

update public.service_interruptions
set interruption_class = case when interruption_type='planned_shutdown' then 'planned' else 'unplanned' end
where interruption_class is null;

alter table public.service_interruptions
  alter column estimated_water_loss_m3 drop not null,
  alter column affected_subscribers drop not null;

alter table public.service_interruptions add constraint service_interruptions_class_ck
  check (interruption_class is null or interruption_class in ('planned','unplanned'));
alter table public.service_interruptions add constraint service_interruptions_start_source_ck
  check (started_at_source in ('reported','observed'));
alter table public.service_interruptions add constraint service_interruptions_derived_metrics_ck
  check ((potentially_affected_production_m3 is null or potentially_affected_production_m3>=0)
     and (coverage_benchmark_lpd is null or coverage_benchmark_lpd>0)
     and (coverage_equivalent_person_days is null or coverage_equivalent_person_days>=0));

create index if not exists idx_service_interruptions_project_started on public.service_interruptions(project_id,started_at desc);
create index if not exists idx_service_interruptions_fault on public.service_interruptions(fault_id);
create index if not exists idx_service_interruptions_pump on public.service_interruptions(pump_id,started_at desc);
create index if not exists idx_faults_interruption on public.faults(interruption_id);

alter table public.faults drop constraint if exists faults_interruption_fk;
alter table public.faults add constraint faults_interruption_fk foreign key(interruption_id) references public.service_interruptions(id) on delete set null;
alter table public.service_interruptions drop constraint if exists service_interruptions_fault_fk;
alter table public.service_interruptions add constraint service_interruptions_fault_fk foreign key(fault_id) references public.faults(id) on delete set null;
alter table public.service_interruptions drop constraint if exists service_interruptions_production_meter_fk;
alter table public.service_interruptions add constraint service_interruptions_production_meter_fk foreign key(production_meter_id) references public.water_production_meters(id) on delete set null;
alter table public.service_interruptions drop constraint if exists service_interruptions_stop_reading_fk;
alter table public.service_interruptions add constraint service_interruptions_stop_reading_fk foreign key(stop_reading_id) references public.water_production_readings(id) on delete set null;
alter table public.service_interruptions drop constraint if exists service_interruptions_restart_reading_fk;
alter table public.service_interruptions add constraint service_interruptions_restart_reading_fk foreign key(restart_reading_id) references public.water_production_readings(id) on delete set null;

create or replace function public.mizan_report_fault_with_impact(
 p_project_id uuid,p_fault_type text,p_severity text default 'medium',p_description text default null,
 p_asset_id uuid default null,p_well_id uuid default null,p_pump_id uuid default null,
 p_causes_service_interruption boolean default false,p_interruption_type text default 'production_stop',
 p_started_at timestamptz default null,p_start_time_reason text default null,
 p_cause_category text default null,p_cause_description text default null,
 p_production_meter_id uuid default null,p_coverage_benchmark_lpd numeric default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_fault public.faults; v_interruption public.service_interruptions; v_now timestamptz:=now(); v_started_at timestamptz; v_meter_project uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_project_id is null or nullif(trim(coalesce(p_fault_type,'')),'') is null then raise exception 'FAULT_TYPE_REQUIRED'; end if;
 if p_severity not in ('low','medium','high','critical') then raise exception 'INVALID_SEVERITY'; end if;
 if not private.mizan_can_write_project(p_project_id,'faults','insert') then raise exception 'FAULT_CREATE_FORBIDDEN'; end if;
 if p_asset_id is not null and not exists(select 1 from public.assets where id=p_asset_id and project_id=p_project_id) then raise exception 'ASSET_PROJECT_MISMATCH'; end if;
 if p_well_id is not null and not exists(select 1 from public.wells where id=p_well_id and project_id=p_project_id) then raise exception 'WELL_PROJECT_MISMATCH'; end if;
 if p_pump_id is not null and not exists(select 1 from public.pumps where id=p_pump_id and project_id=p_project_id) then raise exception 'PUMP_PROJECT_MISMATCH'; end if;
 if p_production_meter_id is not null then
   select project_id into v_meter_project from public.water_production_meters where id=p_production_meter_id;
   if v_meter_project is distinct from p_project_id then raise exception 'PRODUCTION_METER_PROJECT_MISMATCH'; end if;
 end if;
 if p_causes_service_interruption then
   if p_interruption_type not in ('service_stop','production_stop','emergency_shutdown') then raise exception 'INVALID_UNPLANNED_INTERRUPTION_TYPE'; end if;
   v_started_at:=coalesce(p_started_at,v_now);
   if p_started_at is not null and abs(extract(epoch from(v_now-p_started_at)))>60 and nullif(trim(coalesce(p_start_time_reason,'')),'') is null then raise exception 'START_TIME_REASON_REQUIRED'; end if;
 end if;
 insert into public.faults(project_id,fault_type,severity,status,description,reported_by,reporter_type,asset_id,well_id,pump_id,causes_service_interruption)
 values(p_project_id,trim(p_fault_type),p_severity,'reported',nullif(trim(p_description),''),coalesce((select full_name from public.profiles where id=auth.uid()),auth.uid()::text),'staff',p_asset_id,p_well_id,p_pump_id,p_causes_service_interruption)
 returning * into v_fault;
 if p_causes_service_interruption then
   insert into public.service_interruptions(project_id,fault_id,asset_id,well_id,pump_id,production_meter_id,interruption_type,interruption_class,severity,status,cause_category,cause_description,description,reported_at,started_at,started_at_source,start_time_reason,start_time_recorded_at,start_time_recorded_by,affected_subscribers,estimated_water_loss_m3,coverage_benchmark_lpd)
   values(p_project_id,v_fault.id,p_asset_id,p_well_id,p_pump_id,p_production_meter_id,p_interruption_type,'unplanned',p_severity,'open',nullif(trim(p_cause_category),''),nullif(trim(p_cause_description),''),nullif(trim(p_description),''),v_now,v_started_at,case when p_started_at is null then 'reported' else 'observed' end,nullif(trim(p_start_time_reason),''),case when p_started_at is null then null else v_now end,case when p_started_at is null then null else auth.uid() end,null,null,p_coverage_benchmark_lpd)
   returning * into v_interruption;
   update public.faults set interruption_id=v_interruption.id where id=v_fault.id;
 end if;
 perform private.mizan_write_audit(p_project_id,'FAULT_REPORTED','fault',v_fault.id,null,jsonb_build_object('fault_number',v_fault.fault_number,'causes_service_interruption',p_causes_service_interruption,'interruption_id',v_interruption.id),null,'success');
 return jsonb_build_object('fault',to_jsonb(v_fault),'interruption',case when v_interruption.id is null then null else to_jsonb(v_interruption) end);
end;$function$;

revoke execute on function public.mizan_report_fault_with_impact(uuid,text,text,text,uuid,uuid,uuid,boolean,text,timestamptz,text,text,text,uuid,numeric) from public,anon;
grant execute on function public.mizan_report_fault_with_impact(uuid,text,text,text,uuid,uuid,uuid,boolean,text,timestamptz,text,text,text,uuid,numeric) to authenticated;

create or replace function public.mizan_capture_interruption_meter_reading(
 p_interruption_id uuid,p_reading_value numeric,p_captured_at timestamptz,p_image_url text,
 p_gps_lat numeric default null,p_gps_lng numeric default null,p_gps_accuracy numeric default null,
 p_notes text default null,p_evidence_phase text default 'stop')
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_i public.service_interruptions; v_r public.water_production_readings;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_i from public.service_interruptions where id=p_interruption_id for update;
 if v_i.id is null then raise exception 'INTERRUPTION_NOT_FOUND'; end if;
 if not private.mizan_can_access_project(v_i.project_id) then raise exception 'INTERRUPTION_PROJECT_FORBIDDEN'; end if;
 if not private.mizan_has_permission('water.production.capture') then raise exception 'PRODUCTION_CAPTURE_FORBIDDEN'; end if;
 if v_i.production_meter_id is null then raise exception 'PRODUCTION_METER_REQUIRED'; end if;
 if p_evidence_phase not in ('stop','restart') then raise exception 'INVALID_EVIDENCE_PHASE'; end if;
 select * into v_r from public.mizan_capture_water_production_reading(v_i.production_meter_id,p_reading_value,coalesce(p_captured_at,now()),'stop',p_image_url,p_gps_lat,p_gps_lng,p_gps_accuracy,p_notes);
 if p_evidence_phase='stop' then update public.service_interruptions set stop_reading_id=v_r.id where id=v_i.id;
 else update public.service_interruptions set restart_reading_id=v_r.id where id=v_i.id; end if;
 return jsonb_build_object('interruption_id',v_i.id,'reading_id',v_r.id,'evidence_phase',p_evidence_phase,'reading',to_jsonb(v_r));
end;$function$;

revoke execute on function public.mizan_capture_interruption_meter_reading(uuid,numeric,timestamptz,text,numeric,numeric,numeric,text,text) from public,anon;
grant execute on function public.mizan_capture_interruption_meter_reading(uuid,numeric,timestamptz,text,numeric,numeric,numeric,text,text) to authenticated;

create or replace function public.mizan_restore_service_interruption(p_interruption_id uuid,p_restart_reading_id uuid default null,p_coverage_benchmark_lpd numeric default null)
returns public.service_interruptions language plpgsql security definer set search_path=''
as $function$
declare v_i public.service_interruptions; v_r public.water_production_readings; v_rate numeric; v_hours numeric; v_potential numeric; v_benchmark numeric;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not private.mizan_has_permission('maintenance.execute') then raise exception 'INTERRUPTION_RESTORE_FORBIDDEN'; end if;
 select * into v_i from public.service_interruptions where id=p_interruption_id for update;
 if v_i.id is null then raise exception 'INTERRUPTION_NOT_FOUND'; end if;
 if not private.mizan_can_access_project(v_i.project_id) then raise exception 'INTERRUPTION_PROJECT_FORBIDDEN'; end if;
 if v_i.status in ('restored','closed') then raise exception 'INTERRUPTION_ALREADY_RESTORED'; end if;
 if p_restart_reading_id is not null then
   select * into v_r from public.water_production_readings where id=p_restart_reading_id and project_id=v_i.project_id and production_meter_id=v_i.production_meter_id;
   if v_r.id is null then raise exception 'RESTART_READING_MISMATCH'; end if;
   if v_r.captured_at<v_i.started_at then raise exception 'RESTART_READING_BEFORE_START'; end if;
 end if;
 select p.flow_rate_m3_h into v_rate from public.pumps p where p.id=v_i.pump_id and p.project_id=v_i.project_id;
 v_hours:=greatest(0,extract(epoch from(coalesce(v_r.captured_at,now())-v_i.started_at))/3600.0);
 if v_rate is not null and v_rate>0 then v_potential:=round((v_rate*v_hours)::numeric,3); end if;
 v_benchmark:=coalesce(p_coverage_benchmark_lpd,v_i.coverage_benchmark_lpd);
 update public.service_interruptions
 set status='restored',restored_at=coalesce(v_r.captured_at,now()),restored_by=auth.uid(),
     restart_reading_id=coalesce(p_restart_reading_id,restart_reading_id),
     potentially_affected_production_m3=v_potential,coverage_benchmark_lpd=v_benchmark,
     coverage_equivalent_person_days=case when v_benchmark is not null and v_benchmark>0 and v_potential is not null then round((v_potential*1000.0/v_benchmark)::numeric,2) else null end
 where id=v_i.id returning * into v_i;
 perform private.mizan_write_audit(v_i.project_id,'SERVICE_INTERRUPTION_RESTORED','service_interruption',v_i.id,null,jsonb_build_object('interruption_number',v_i.interruption_number,'restored_at',v_i.restored_at,'restart_reading_id',v_i.restart_reading_id,'potentially_affected_production_m3',v_i.potentially_affected_production_m3),null,'success');
 return v_i;
end;$function$;

revoke execute on function public.mizan_restore_service_interruption(uuid,uuid,numeric) from public,anon;
grant execute on function public.mizan_restore_service_interruption(uuid,uuid,numeric) to authenticated;

create or replace function public.mizan_maintenance_report(p_project_id uuid,p_period_start date,p_period_end date)
returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare v jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_project_id is null or p_period_start is null or p_period_end is null then raise exception 'REPORT_PERIOD_REQUIRED'; end if;
 if p_period_end<p_period_start then raise exception 'REPORT_PERIOD_INVALID'; end if;
 if not private.mizan_can_access_project(p_project_id) then raise exception 'REPORT_PROJECT_FORBIDDEN'; end if;
 select jsonb_build_object(
  'project_id',p_project_id,'period_start',p_period_start,'period_end',p_period_end,
  'work_orders_created',(select count(*) from public.maintenance_work_orders where project_id=p_project_id and created_at>=p_period_start and created_at<(p_period_end+1)),
  'work_orders_completed',(select count(*) from public.maintenance_work_orders where project_id=p_project_id and completed_date>=p_period_start and completed_date<(p_period_end+1)),
  'work_orders_closed',(select count(*) from public.maintenance_work_orders where project_id=p_project_id and closed_at>=p_period_start and closed_at<(p_period_end+1)),
  'work_orders_open_at_end',(select count(*) from public.maintenance_work_orders where project_id=p_project_id and created_at<(p_period_end+1) and status in ('open','in_progress','review_required')),
  'faults_reported',(select count(*) from public.faults where project_id=p_project_id and reported_at>=p_period_start and reported_at<(p_period_end+1)),
  'unplanned_interruptions',(select count(*) from public.service_interruptions where project_id=p_project_id and interruption_class='unplanned' and started_at<(p_period_end+1) and coalesce(restored_at,now())>=p_period_start),
  'planned_interruptions',(select count(*) from public.service_interruptions where project_id=p_project_id and interruption_class='planned' and started_at<(p_period_end+1) and coalesce(restored_at,now())>=p_period_start),
  'total_downtime_hours',coalesce((select sum(greatest(0,extract(epoch from(coalesce(restored_at,now())-started_at))/3600.0)) from public.service_interruptions where project_id=p_project_id and started_at<(p_period_end+1) and coalesce(restored_at,now())>=p_period_start),0),
  'potentially_affected_production_m3',coalesce((select sum(coalesce(potentially_affected_production_m3,0)) from public.service_interruptions where project_id=p_project_id and started_at<(p_period_end+1) and coalesce(restored_at,now())>=p_period_start),0)
 ) into v;
 return v;
end;$function$;

revoke execute on function public.mizan_maintenance_report(uuid,date,date) from public,anon;
grant execute on function public.mizan_maintenance_report(uuid,date,date) to authenticated;

revoke insert,update,delete on public.faults from anon,authenticated;
revoke insert,update,delete on public.service_interruptions from anon,authenticated;
revoke insert,update,delete on public.maintenance_work_orders from anon,authenticated;

create or replace function public.mizan_register_asset(
 p_project_id uuid,p_name_ar text,p_category text default null,p_type text default null,
 p_manufacturer text default null,p_model text default null,p_serial_number text default null,
 p_status text default 'operational',p_purchase_cost numeric default null,
 p_expected_lifespan_years numeric default null,p_purchase_date date default null,p_installation_date date default null)
returns public.assets language plpgsql security definer set search_path=''
as $function$
declare v public.assets;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if nullif(trim(coalesce(p_name_ar,'')),'') is null then raise exception 'ASSET_NAME_REQUIRED'; end if;
 if not private.mizan_can_write_project(p_project_id,'assets','insert') then raise exception 'ASSET_CREATE_FORBIDDEN'; end if;
 if p_purchase_cost is not null and p_purchase_cost<0 then raise exception 'INVALID_ASSET_COST'; end if;
 insert into public.assets(project_id,name_ar,category,type,manufacturer,model,serial_number,status,purchase_cost,expected_lifespan_years,purchase_date,installation_date)
 values(p_project_id,trim(p_name_ar),nullif(trim(p_category),''),nullif(trim(p_type),''),nullif(trim(p_manufacturer),''),nullif(trim(p_model),''),nullif(trim(p_serial_number),''),coalesce(nullif(trim(p_status),''),'operational'),p_purchase_cost,p_expected_lifespan_years,p_purchase_date,p_installation_date)
 returning * into v;
 perform private.mizan_write_audit(v.project_id,'ASSET_REGISTERED','asset',v.id,null,jsonb_build_object('asset_code',v.asset_code,'name_ar',v.name_ar),null,'success');
 return v;
end;$function$;

revoke execute on function public.mizan_register_asset(uuid,text,text,text,text,text,text,text,numeric,numeric,date,date) from public,anon;
grant execute on function public.mizan_register_asset(uuid,text,text,text,text,text,text,text,numeric,numeric,date,date) to authenticated;
