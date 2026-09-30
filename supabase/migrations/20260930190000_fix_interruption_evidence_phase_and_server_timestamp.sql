create or replace function public.mizan_capture_interruption_meter_reading(
  p_interruption_id uuid, p_reading_value numeric, p_captured_at timestamptz, p_image_url text,
  p_gps_lat numeric default null, p_gps_lng numeric default null, p_gps_accuracy numeric default null,
  p_notes text default null, p_evidence_phase text default 'stop'
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_i public.service_interruptions; v_r public.water_production_readings; v_meter uuid; v_capture_phase text; v_captured_at timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_i from public.service_interruptions where id=p_interruption_id for update;
  if v_i.id is null then raise exception 'INTERRUPTION_NOT_FOUND'; end if;
  if not private.mizan_can_access_project(v_i.project_id) then raise exception 'INTERRUPTION_PROJECT_FORBIDDEN'; end if;
  if not private.mizan_has_permission('water.production.capture') then raise exception 'PRODUCTION_CAPTURE_FORBIDDEN'; end if;
  if p_evidence_phase not in ('stop','restart') then raise exception 'INVALID_EVIDENCE_PHASE'; end if;
  if p_reading_value is null or p_reading_value < 0 then raise exception 'INVALID_READING_VALUE'; end if;
  v_meter:=v_i.production_meter_id;
  if v_meter is null and v_i.pump_id is not null then
    select id into v_meter from public.water_production_meters where project_id=v_i.project_id and pump_id=v_i.pump_id and status='active' order by created_at desc limit 1;
  end if;
  if v_meter is null then raise exception 'PRODUCTION_METER_REQUIRED'; end if;
  if p_evidence_phase='stop' then
    if v_i.stop_reading_id is not null then raise exception 'STOP_EVIDENCE_ALREADY_EXISTS'; end if;
    v_capture_phase:='check';
  else
    if v_i.stop_reading_id is null then raise exception 'STOP_EVIDENCE_REQUIRED_FIRST'; end if;
    if v_i.restart_reading_id is not null then raise exception 'RESTART_EVIDENCE_ALREADY_EXISTS'; end if;
    v_capture_phase:='check';
  end if;
  v_captured_at:=now();
  select * into v_r from public.mizan_capture_water_production_reading(v_meter,p_reading_value,v_captured_at,v_capture_phase,p_image_url,p_gps_lat,p_gps_lng,p_gps_accuracy,p_notes);
  if p_evidence_phase='stop' then
    update public.service_interruptions set production_meter_id=v_meter,stop_reading_id=v_r.id where id=v_i.id;
  else
    update public.service_interruptions set production_meter_id=v_meter,restart_reading_id=v_r.id where id=v_i.id;
  end if;
  return jsonb_build_object('interruption_id',v_i.id,'reading_id',v_r.id,'evidence_phase',p_evidence_phase,'capture_phase',v_capture_phase,'captured_at',v_captured_at,'reading',to_jsonb(v_r));
end;
$function$;
