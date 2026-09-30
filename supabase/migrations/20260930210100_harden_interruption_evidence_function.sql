drop function if exists public.mizan_capture_interruption_meter_reading(uuid,numeric,timestamptz,text,numeric,numeric,numeric,text,text);

create function public.mizan_capture_interruption_meter_reading(
 p_interruption_id uuid,p_reading_value numeric,p_captured_at timestamptz,p_image_url text,p_gps_lat numeric default null,
 p_gps_lng numeric default null,p_gps_accuracy numeric default null,p_notes text default null,p_evidence_phase text default 'stop',
 p_detected_serial_number text default null,p_ai_confidence numeric default null,p_ai_model text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_i public.service_interruptions;v_r public.water_production_readings;v_meter uuid;v_expected_path text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not private.mizan_has_permission('maintenance.execute') then raise exception 'INTERRUPTION_EVIDENCE_FORBIDDEN'; end if;
 select * into v_i from public.service_interruptions where id=p_interruption_id for update;
 if v_i.id is null then raise exception 'INTERRUPTION_NOT_FOUND'; end if;
 if not private.mizan_can_access_project(v_i.project_id) then raise exception 'INTERRUPTION_PROJECT_FORBIDDEN'; end if;
 if not private.mizan_has_permission('water.production.capture') then raise exception 'PRODUCTION_CAPTURE_FORBIDDEN'; end if;
 if p_evidence_phase not in('stop','restart') then raise exception 'INVALID_EVIDENCE_PHASE'; end if;
 v_meter:=v_i.production_meter_id;
 if v_meter is null and v_i.pump_id is not null then select id into v_meter from public.water_production_meters where project_id=v_i.project_id and pump_id=v_i.pump_id and status='active' order by created_at desc limit 1; end if;
 if v_meter is null then raise exception 'PRODUCTION_METER_REQUIRED'; end if;
 v_expected_path:=v_i.project_id::text||'/production/'||v_meter::text||'/interruption/'||v_i.id::text||'/';
 if nullif(trim(coalesce(p_image_url,'')),'') is null then raise exception 'INTERRUPTION_EVIDENCE_IMAGE_REQUIRED'; end if;
 if left(p_image_url,length(v_expected_path))<>v_expected_path then raise exception 'INTERRUPTION_EVIDENCE_PATH_INVALID'; end if;
 if p_evidence_phase='stop' and v_i.stop_reading_id is not null then raise exception 'STOP_EVIDENCE_ALREADY_EXISTS'; end if;
 if p_evidence_phase='restart' and v_i.stop_reading_id is null then raise exception 'STOP_EVIDENCE_REQUIRED_FIRST'; end if;
 if p_evidence_phase='restart' and v_i.restart_reading_id is not null then raise exception 'RESTART_EVIDENCE_ALREADY_EXISTS'; end if;
 select * into v_r from public.mizan_capture_water_production_reading(v_meter,p_reading_value,now(),'check',p_image_url,p_gps_lat,p_gps_lng,p_gps_accuracy,p_notes,p_detected_serial_number,p_ai_confidence,p_ai_model);
 if p_evidence_phase='stop' then update public.service_interruptions set production_meter_id=v_meter,stop_reading_id=v_r.id where id=v_i.id; else update public.service_interruptions set production_meter_id=v_meter,restart_reading_id=v_r.id where id=v_i.id; end if;
 return jsonb_build_object('interruption_id',v_i.id,'reading_id',v_r.id,'evidence_phase',p_evidence_phase,'captured_at',v_r.captured_at,'reading',to_jsonb(v_r));
end;$function$;