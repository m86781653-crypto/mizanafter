drop function if exists public.mizan_capture_water_production_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text);

create function public.mizan_capture_water_production_reading(
 p_production_meter_id uuid,p_reading_value numeric,p_captured_at timestamptz default now(),p_capture_phase text default 'check',
 p_image_url text default null,p_gps_lat numeric default null,p_gps_lng numeric default null,p_gps_accuracy numeric default null,
 p_notes text default null,p_detected_serial_number text default null,p_ai_confidence numeric default null,p_ai_model text default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=auth.uid();v_meter public.water_production_meters%rowtype;v_id uuid;v_prefix text;v_expected_serial text;v_detected_serial text;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if not private.mizan_has_permission('water.production.capture') then raise exception 'PRODUCTION_CAPTURE_FORBIDDEN' using errcode='42501'; end if;
 if p_reading_value is null or p_reading_value<0 then raise exception 'READING_VALUE_INVALID' using errcode='22023'; end if;
 if p_capture_phase not in('start','stop','check') then raise exception 'CAPTURE_PHASE_INVALID' using errcode='22023'; end if;
 select * into v_meter from public.water_production_meters where id=p_production_meter_id and status='active';
 if not found then raise exception 'PRODUCTION_METER_NOT_FOUND' using errcode='22023'; end if;
 if not private.mizan_can_access_project(v_meter.project_id) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501'; end if;
 if nullif(trim(coalesce(p_image_url,'')),'') is null then raise exception 'PRODUCTION_EVIDENCE_IMAGE_REQUIRED' using errcode='22023'; end if;
 if nullif(trim(coalesce(v_meter.serial_number,'')),'') is null then raise exception 'PRODUCTION_METER_SERIAL_REQUIRED' using errcode='22023'; end if;
 if p_ai_confidence is null or p_ai_confidence<70 or p_ai_confidence>100 then raise exception 'PRODUCTION_OCR_CONFIDENCE_INVALID' using errcode='22023'; end if;
 if nullif(trim(coalesce(p_ai_model,'')),'') is null then raise exception 'PRODUCTION_OCR_MODEL_REQUIRED' using errcode='22023'; end if;
 v_expected_serial:=upper(regexp_replace(trim(v_meter.serial_number),'[^a-zA-Z0-9]+','','g'));
 v_detected_serial:=upper(regexp_replace(trim(coalesce(p_detected_serial_number,'')),'[^a-zA-Z0-9]+','','g'));
 if v_detected_serial='' or v_expected_serial<>v_detected_serial then raise exception 'PRODUCTION_METER_IDENTITY_MISMATCH' using errcode='22023'; end if;
 v_prefix:=v_meter.project_id::text||'/production/'||v_meter.id::text||'/';
 if left(p_image_url,length(v_prefix))<>v_prefix then raise exception 'PRODUCTION_EVIDENCE_PATH_INVALID' using errcode='22023'; end if;
 insert into public.water_production_readings(project_id,production_meter_id,well_id,pump_id,reading_value,captured_at,capture_phase,image_url,gps_lat,gps_lng,gps_accuracy,captured_by,notes)
 values(v_meter.project_id,v_meter.id,v_meter.well_id,v_meter.pump_id,p_reading_value,coalesce(p_captured_at,now()),p_capture_phase,nullif(trim(p_image_url),''),p_gps_lat,p_gps_lng,p_gps_accuracy,v_uid,nullif(trim(coalesce(p_notes,'')),''))
 returning id into v_id;
 return v_id;
end;$function$;

revoke execute on function public.mizan_capture_water_production_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text,text,numeric,text) from public,anon;
grant execute on function public.mizan_capture_water_production_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text,text,numeric,text) to authenticated;