-- Billing integrity follow-up: multi-segment invoices may span household changes,
-- therefore household_members is nullable; the authoritative per-segment values remain
-- in calculation_snapshot.

alter table public.invoices
  alter column household_members drop not null;

create or replace function public.mrx_capture_meter_reading(
  p_meter_id uuid,p_reading_value numeric,p_reading_date timestamptz default null,
  p_reading_method text default 'photo',p_image_url text default null,p_gps_lat numeric default null,
  p_gps_lng numeric default null,p_gps_accuracy numeric default null,p_ai_extracted_value numeric default null,
  p_ai_confidence numeric default null,p_ai_model text default null,p_notes text default null,
  p_client_capture_id uuid default null,p_detected_meter_number text default null
)
returns public.meter_readings language plpgsql security definer set search_path=''
as $function$
declare
  v_meter public.meters%rowtype; v_previous numeric; v_previous_date timestamptz;
  v_reading_date timestamptz; v_project_id uuid; v_customer_id uuid;
  v_reading public.meter_readings%rowtype; v_expected_serial text; v_detected_serial text; v_business_date date;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reading_value is null or p_reading_value<0 then raise exception 'INVALID_READING_VALUE'; end if;

  select * into v_meter from public.meters where id=p_meter_id for update;
  if not found then raise exception 'METER_NOT_FOUND'; end if;

  v_project_id:=v_meter.project_id;
  v_customer_id:=v_meter.customer_id;
  v_expected_serial:=lower(regexp_replace(coalesce(v_meter.serial_number,''),'[^a-zA-Z0-9]+','','g'));
  v_detected_serial:=lower(regexp_replace(coalesce(p_detected_meter_number,''),'[^a-zA-Z0-9]+','','g'));

  if not private.mizan_has_permission('meter.capture')
     or not private.mizan_can_write_project(v_project_id,'meter_readings','insert')
  then raise exception 'METER_CAPTURE_FORBIDDEN'; end if;

  if v_meter.status<>'active' then raise exception 'METER_NOT_ACTIVE'; end if;
  if v_customer_id is null then raise exception 'METER_CUSTOMER_REQUIRED'; end if;
  if v_expected_serial='' then raise exception 'METER_SERIAL_REQUIRED'; end if;

  if p_client_capture_id is not null then
    select * into v_reading
    from public.meter_readings
    where client_capture_id=p_client_capture_id and meter_id=p_meter_id
    limit 1;
    if found then return v_reading; end if;
  end if;

  v_reading_date:=coalesce(p_reading_date,now());
  v_business_date:=(v_reading_date at time zone 'Asia/Aden')::date;

  if exists(
    select 1 from public.meter_readings mr
    where mr.meter_id=p_meter_id
      and mr.business_date=v_business_date
      and mr.status not in ('void','exception')
  ) then
    raise exception 'READING_ALREADY_EXISTS_FOR_DATE';
  end if;

  if exists(
    select 1 from public.customers c
    where c.id=v_customer_id
      and c.connection_date is not null
      and v_business_date<c.connection_date
  ) then
    raise exception 'READING_BEFORE_SERVICE_START';
  end if;

  if v_meter.installation_date is not null and v_business_date<v_meter.installation_date then
    raise exception 'READING_BEFORE_METER_INSTALLATION';
  end if;

  select mr.reading_value,mr.reading_date
    into v_previous,v_previous_date
  from public.meter_readings mr
  where mr.meter_id=p_meter_id
    and mr.reading_date <= v_reading_date
    and mr.status not in ('void','exception')
  order by mr.reading_date desc,mr.created_at desc
  limit 1;

  v_previous:=coalesce(v_previous,v_meter.last_reading,0);

  if p_reading_value<v_previous then
    raise exception 'READING_DECREASE_REQUIRES_EXCEPTION';
  end if;

  if p_ai_confidence is not null and (p_ai_confidence<0 or p_ai_confidence>100) then
    raise exception 'INVALID_AI_CONFIDENCE';
  end if;

  if lower(coalesce(p_reading_method,''))='photo' then
    if p_image_url is null or p_ai_extracted_value is null or p_ai_confidence is null or p_ai_model is null then
      raise exception 'PHOTO_OCR_REQUIRED';
    end if;
    if p_ai_confidence<70 then raise exception 'OCR_CONFIDENCE_TOO_LOW'; end if;
    if abs(p_reading_value-p_ai_extracted_value)>0.01 then raise exception 'READING_MUST_MATCH_OCR'; end if;
    if v_expected_serial<>v_detected_serial then raise exception 'METER_IDENTITY_MISMATCH'; end if;
  elsif lower(coalesce(p_reading_method,''))='manual_exception' then
    if not private.mizan_has_permission('meter.exception') then raise exception 'METER_EXCEPTION_FORBIDDEN'; end if;
    if nullif(trim(coalesce(p_notes,'')),'') is null then raise exception 'EXCEPTION_REASON_REQUIRED'; end if;
  else
    raise exception 'INVALID_READING_METHOD';
  end if;

  insert into public.meter_readings(
    meter_id,project_id,customer_id,reading_value,previous_reading,consumption,reading_date,
    reading_method,image_url,ai_extracted_value,ai_confidence,ai_model,ai_detected_meter_number,
    status,anomaly_flag,anomaly_reason,gps_lat,gps_lng,gps_accuracy,sync_status,reader_name,notes,client_capture_id
  )
  values(
    p_meter_id,v_project_id,v_customer_id,p_reading_value,v_previous,p_reading_value-v_previous,
    v_reading_date,coalesce(nullif(p_reading_method,''),'photo'),p_image_url,p_ai_extracted_value,
    p_ai_confidence,p_ai_model,p_detected_meter_number,'recorded',false,null,p_gps_lat,p_gps_lng,
    p_gps_accuracy,'synced',(select p.full_name from public.profiles p where p.id=(select auth.uid())),
    p_notes,p_client_capture_id
  )
  returning * into v_reading;

  update public.meters
  set last_reading=p_reading_value,last_reading_date=v_reading_date,updated_at=now()
  where id=p_meter_id;

  perform private.mizan_issue_invoice_for_reading(
    v_reading.id,
    case when v_previous_date is not null
      then (v_previous_date at time zone 'Asia/Aden')::date
      else null
    end,
    (v_reading_date at time zone 'Asia/Aden')::date
  );

  insert into public.audit_logs(
    table_name,record_id,action,user_id,actor_user_id,project_id,entity_type,entity_id,reason,result,before_data,after_data
  )
  values(
    'meter_readings',v_reading.id,'MRX_CAPTURE',(select auth.uid()),(select auth.uid()),v_project_id,
    'meter_reading',v_reading.id,
    case when lower(coalesce(p_reading_method,''))='manual_exception' then p_notes else null end,
    'recorded',
    jsonb_build_object('previous_reading',v_previous,'client_capture_id',p_client_capture_id),
    jsonb_build_object(
      'reading_value',p_reading_value,'reading_method',p_reading_method,'reading_date',v_reading_date,
      'status','recorded','ai_confidence',p_ai_confidence,'ai_model',p_ai_model,
      'detected_serial_number',p_detected_meter_number,
      'gps_lat',p_gps_lat,'gps_lng',p_gps_lng,'gps_accuracy',p_gps_accuracy,
      'client_capture_id',p_client_capture_id
    )
  );

  return v_reading;
end;
$function$;

revoke execute on function public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text) from public,anon;
grant execute on function public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text) to authenticated;
