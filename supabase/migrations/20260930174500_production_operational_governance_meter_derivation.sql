-- Finalize production operational governance meter derivation and interruption evidence.
alter table public.service_interruptions alter column interruption_class set not null;

create or replace function public.mizan_capture_interruption_meter_reading(
 p_interruption_id uuid,p_reading_value numeric,p_captured_at timestamptz,p_image_url text,
 p_gps_lat numeric default null,p_gps_lng numeric default null,p_gps_accuracy numeric default null,
 p_notes text default null,p_evidence_phase text default 'stop')
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_i public.service_interruptions; v_r public.water_production_readings; v_meter uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_i from public.service_interruptions where id=p_interruption_id for update;
 if v_i.id is null then raise exception 'INTERRUPTION_NOT_FOUND'; end if;
 if not private.mizan_can_access_project(v_i.project_id) then raise exception 'INTERRUPTION_PROJECT_FORBIDDEN'; end if;
 if not private.mizan_has_permission('water.production.capture') then raise exception 'PRODUCTION_CAPTURE_FORBIDDEN'; end if;
 if p_evidence_phase not in ('stop','restart') then raise exception 'INVALID_EVIDENCE_PHASE'; end if;
 v_meter:=v_i.production_meter_id;
 if v_meter is null and v_i.pump_id is not null then
   select id into v_meter from public.water_production_meters where project_id=v_i.project_id and pump_id=v_i.pump_id and status='active' order by created_at desc limit 1;
 end if;
 if v_meter is null then raise exception 'PRODUCTION_METER_REQUIRED'; end if;
 select * into v_r from public.mizan_capture_water_production_reading(v_meter,p_reading_value,coalesce(p_captured_at,now()),case when p_evidence_phase='stop' then 'stop' else 'check' end,p_image_url,p_gps_lat,p_gps_lng,p_gps_accuracy,p_notes);
 if p_evidence_phase='stop' then update public.service_interruptions set production_meter_id=v_meter,stop_reading_id=v_r.id where id=v_i.id;
 else update public.service_interruptions set production_meter_id=v_meter,restart_reading_id=v_r.id where id=v_i.id; end if;
 return jsonb_build_object('interruption_id',v_i.id,'reading_id',v_r.id,'evidence_phase',p_evidence_phase,'reading',to_jsonb(v_r));
end;$function$;

revoke execute on function public.mizan_capture_interruption_meter_reading(uuid,numeric,timestamptz,text,numeric,numeric,numeric,text,text) from public,anon;
grant execute on function public.mizan_capture_interruption_meter_reading(uuid,numeric,timestamptz,text,numeric,numeric,numeric,text,text) to authenticated;

create or replace function public.mizan_report_fault_with_impact(
 p_project_id uuid,p_fault_type text,p_severity text default 'medium',p_description text default null,
 p_asset_id uuid default null,p_well_id uuid default null,p_pump_id uuid default null,
 p_causes_service_interruption boolean default false,p_interruption_type text default 'production_stop',
 p_started_at timestamptz default null,p_start_time_reason text default null,
 p_cause_category text default null,p_cause_description text default null,
 p_production_meter_id uuid default null,p_coverage_benchmark_lpd numeric default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_fault public.faults; v_interruption public.service_interruptions; v_now timestamptz:=now(); v_started_at timestamptz; v_meter_project uuid; v_meter uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_project_id is null or nullif(trim(coalesce(p_fault_type,'')),'') is null then raise exception 'FAULT_TYPE_REQUIRED'; end if;
 if p_severity not in ('low','medium','high','critical') then raise exception 'INVALID_SEVERITY'; end if;
 if not private.mizan_can_write_project(p_project_id,'faults','insert') then raise exception 'FAULT_CREATE_FORBIDDEN'; end if;
 if p_asset_id is not null and not exists(select 1 from public.assets where id=p_asset_id and project_id=p_project_id) then raise exception 'ASSET_PROJECT_MISMATCH'; end if;
 if p_well_id is not null and not exists(select 1 from public.wells where id=p_well_id and project_id=p_project_id) then raise exception 'WELL_PROJECT_MISMATCH'; end if;
 if p_pump_id is not null and not exists(select 1 from public.pumps where id=p_pump_id and project_id=p_project_id) then raise exception 'PUMP_PROJECT_MISMATCH'; end if;
 if p_production_meter_id is not null then select id,project_id into v_meter,v_meter_project from public.water_production_meters where id=p_production_meter_id; if v_meter_project is distinct from p_project_id then raise exception 'PRODUCTION_METER_PROJECT_MISMATCH'; end if;
 elsif p_pump_id is not null then select id into v_meter from public.water_production_meters where project_id=p_project_id and pump_id=p_pump_id and status='active' order by created_at desc limit 1; end if;
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
   values(p_project_id,v_fault.id,p_asset_id,p_well_id,p_pump_id,v_meter,p_interruption_type,'unplanned',p_severity,'open',nullif(trim(p_cause_category),''),nullif(trim(p_cause_description),''),nullif(trim(p_description),''),v_now,v_started_at,case when p_started_at is null then 'reported' else 'observed' end,nullif(trim(p_start_time_reason),''),case when p_started_at is null then null else v_now end,case when p_started_at is null then null else auth.uid() end,null,null,p_coverage_benchmark_lpd)
   returning * into v_interruption;
   update public.faults set interruption_id=v_interruption.id where id=v_fault.id;
 end if;
 perform private.mizan_write_audit(p_project_id,'FAULT_REPORTED','fault',v_fault.id,null,jsonb_build_object('fault_number',v_fault.fault_number,'causes_service_interruption',p_causes_service_interruption,'interruption_id',v_interruption.id),null,'success');
 return jsonb_build_object('fault',to_jsonb(v_fault),'interruption',case when v_interruption.id is null then null else to_jsonb(v_interruption) end);
end;$function$;

revoke execute on function public.mizan_report_fault_with_impact(uuid,text,text,text,uuid,uuid,uuid,boolean,text,timestamptz,text,text,text,uuid,numeric) from public,anon;
grant execute on function public.mizan_report_fault_with_impact(uuid,text,text,text,uuid,uuid,uuid,boolean,text,timestamptz,text,text,text,uuid,numeric) to authenticated;
