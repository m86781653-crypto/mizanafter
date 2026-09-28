-- Field collection, automatic billing, tariff allowance, and payment idempotency hardening.
-- Applied to production as migration 20260928180000_field_collection_billing_hardening.

alter table public.tariffs
  add column if not exists base_liters_per_person_per_day numeric not null default 50,
  add column if not exists base_price_per_m3 numeric not null default 0;

alter table public.invoices
  add column if not exists tariff_id uuid references public.tariffs(id),
  add column if not exists tariff_version integer,
  add column if not exists included_consumption_m3 numeric not null default 0,
  add column if not exists tiered_consumption_m3 numeric not null default 0;

alter table public.payments add column if not exists client_payment_id uuid;

create unique index if not exists ux_payments_client_payment_id on public.payments(client_payment_id) where client_payment_id is not null;
create index if not exists idx_tariffs_project_customer_active on public.tariffs(project_id, customer_type, is_active, effective_from desc);

create or replace function private.mizan_issue_invoice_for_reading(p_reading_id uuid,p_period_start date,p_period_end date)
returns public.invoices
language plpgsql security definer set search_path=''
as $function$
declare
  v_reading public.meter_readings%rowtype;
  v_meter public.meters%rowtype;
  v_customer public.customers%rowtype;
  v_tariff public.tariffs%rowtype;
  v_invoice public.invoices%rowtype;
  v_consumption numeric;
  v_allowance_m3 numeric;
  v_included_m3 numeric;
  v_tiered_m3 numeric;
  v_base_fee numeric;
  v_tiered_fee numeric;
  v_fixed_fee numeric;
  v_current_charge numeric;
  v_arrears numeric;
  v_grand_total numeric;
begin
  select * into v_reading from public.meter_readings where id=p_reading_id for update;
  if not found then raise exception 'READING_NOT_FOUND'; end if;
  if exists(select 1 from public.invoices where source_reading_id=p_reading_id) then
    select * into v_invoice from public.invoices where source_reading_id=p_reading_id limit 1;
    return v_invoice;
  end if;
  select * into v_meter from public.meters where id=v_reading.meter_id and project_id=v_reading.project_id for update;
  if not found then raise exception 'METER_NOT_FOUND'; end if;
  select * into v_customer from public.customers where id=v_reading.customer_id and project_id=v_reading.project_id and status='active' for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  v_consumption:=greatest(coalesce(v_reading.consumption,0),0);
  select * into v_tariff from public.tariffs
  where project_id=v_reading.project_id
    and customer_type=coalesce(v_customer.customer_type,'residential')
    and is_active=true
    and effective_from<=p_period_end
    and (effective_to is null or effective_to>=p_period_start)
  order by effective_from desc,version desc,id desc limit 1;
  if not found then raise exception 'ACTIVE_TARIFF_NOT_FOUND'; end if;
  if v_tariff.base_liters_per_person_per_day<0 or v_tariff.base_price_per_m3<0 then
    raise exception 'TARIFF_BASE_VALUES_INVALID';
  end if;

  -- Project policy: 50 L/person/day. A 30-day month gives 1.5 m3/person,
  -- therefore four household members receive 6.0 m3 at the base tariff.
  v_allowance_m3:=greatest(coalesce(v_customer.household_members,0),0)
    * v_tariff.base_liters_per_person_per_day * 30 / 1000;
  v_included_m3:=least(v_consumption,v_allowance_m3);
  v_tiered_m3:=greatest(v_consumption-v_allowance_m3,0);
  v_base_fee:=v_included_m3*coalesce(v_tariff.base_price_per_m3,0);
  v_tiered_fee:=case when v_tiered_m3>0 then private.mizan_calculate_consumption_fee(v_tariff.id,v_tiered_m3) else 0 end;
  v_fixed_fee:=coalesce(v_tariff.fixed_fee,0);
  v_current_charge:=v_fixed_fee+v_base_fee+v_tiered_fee;

  select coalesce(sum(greatest(coalesce(i.balance,0),0)),0) into v_arrears
  from public.invoices i
  where i.customer_id=v_customer.id and i.project_id=v_customer.project_id and i.status<>'paid';
  v_grand_total:=v_current_charge+v_arrears;

  insert into public.invoices(
    project_id,customer_id,meter_id,invoice_number,billing_period_start,billing_period_end,
    previous_reading,current_reading,consumption_m3,fixed_fee,consumption_fee,total_amount,
    previous_balance,grand_total,amount_paid,balance,status,source_reading_id,tariff_id,
    tariff_version,included_consumption_m3,tiered_consumption_m3
  )
  values(
    v_reading.project_id,v_customer.id,v_meter.id,null,p_period_start,p_period_end,
    coalesce(v_reading.previous_reading,0),v_reading.reading_value,v_consumption,
    v_fixed_fee,v_base_fee+v_tiered_fee,v_current_charge,v_arrears,v_grand_total,0,v_grand_total,
    case when v_grand_total=0 then 'paid' else 'unpaid' end,v_reading.id,v_tariff.id,
    v_tariff.version,v_included_m3,v_tiered_m3
  )
  returning * into v_invoice;

  perform private.mizan_write_audit(
    v_reading.project_id,'INVOICE_CREATED_AUTOMATICALLY','invoice',v_invoice.id,null,
    jsonb_build_object(
      'reading_id',v_reading.id,'meter_id',v_meter.id,'customer_id',v_customer.id,
      'consumption_m3',v_consumption,'included_consumption_m3',v_included_m3,
      'tiered_consumption_m3',v_tiered_m3,'previous_balance',v_arrears,
      'grand_total',v_grand_total,'tariff_id',v_tariff.id,'tariff_version',v_tariff.version
    ),null,'success'
  );
  return v_invoice;
end;
$function$;

revoke all on function private.mizan_issue_invoice_for_reading(uuid,date,date) from public,anon,authenticated;
grant usage on schema private to authenticated;

create or replace function public.mizan_create_invoice(p_project_id uuid,p_customer_id uuid,p_meter_id uuid,p_period_start date,p_period_end date)
returns public.invoices language plpgsql security definer set search_path=''
as $function$
declare v_reading public.meter_readings%rowtype; v_invoice public.invoices;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_period_start is null or p_period_end is null or p_period_end<p_period_start then raise exception 'INVALID_BILLING_PERIOD'; end if;
  if not private.mizan_can_write_project(p_project_id,'invoices','insert') then raise exception 'INVOICE_WRITE_FORBIDDEN'; end if;
  select * into v_reading from public.meter_readings
  where meter_id=p_meter_id and project_id=p_project_id and customer_id=p_customer_id and status='approved'
  order by reading_date desc,created_at desc,id desc limit 1;
  if not found then raise exception 'APPROVED_MRX_READING_REQUIRED'; end if;
  select * into v_invoice from private.mizan_issue_invoice_for_reading(v_reading.id,p_period_start,p_period_end);
  return v_invoice;
end;
$function$;

revoke execute on function public.mizan_create_invoice(uuid,uuid,uuid,date,date) from public,anon;
grant execute on function public.mizan_create_invoice(uuid,uuid,uuid,date,date) to authenticated;

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
  v_reading_date timestamptz; v_period_start date; v_project_id uuid; v_customer_id uuid;
  v_reading public.meter_readings%rowtype; v_expected_serial text; v_detected_serial text; v_business_date date;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reading_value is null or p_reading_value<0 then raise exception 'INVALID_READING_VALUE'; end if;
  select * into v_meter from public.meters where id=p_meter_id for update;
  if not found then raise exception 'METER_NOT_FOUND'; end if;
  v_project_id:=v_meter.project_id; v_customer_id:=v_meter.customer_id;
  v_expected_serial:=lower(regexp_replace(coalesce(v_meter.serial_number,''),'[^a-zA-Z0-9]+','','g'));
  v_detected_serial:=lower(regexp_replace(coalesce(p_detected_meter_number,''),'[^a-zA-Z0-9]+','','g'));
  if not private.mizan_has_permission('meter.capture') or not private.mizan_can_write_project(v_project_id,'meter_readings','insert') then raise exception 'METER_CAPTURE_FORBIDDEN'; end if;
  if v_meter.status<>'active' then raise exception 'METER_NOT_ACTIVE'; end if;
  if v_customer_id is null then raise exception 'METER_CUSTOMER_REQUIRED'; end if;
  if v_expected_serial='' then raise exception 'METER_SERIAL_REQUIRED'; end if;
  if p_client_capture_id is not null then
    select * into v_reading from public.meter_readings where client_capture_id=p_client_capture_id and meter_id=p_meter_id limit 1;
    if found then return v_reading; end if;
  end if;
  v_reading_date:=coalesce(p_reading_date,now());
  v_business_date:=(v_reading_date at time zone 'Asia/Aden')::date;
  if exists(select 1 from public.meter_readings mr where mr.meter_id=p_meter_id and mr.business_date=v_business_date and mr.status not in ('void','exception')) then
    raise exception 'READING_ALREADY_EXISTS_FOR_DATE';
  end if;
  select mr.reading_value,mr.reading_date into v_previous,v_previous_date
  from public.meter_readings mr where mr.meter_id=p_meter_id and mr.status not in ('void','exception')
  order by mr.reading_date desc,mr.created_at desc limit 1;
  v_previous:=coalesce(v_previous,v_meter.last_reading,0);
  if p_reading_value<v_previous then raise exception 'READING_DECREASE_REQUIRES_EXCEPTION'; end if;
  if p_ai_confidence is not null and (p_ai_confidence<0 or p_ai_confidence>100) then raise exception 'INVALID_AI_CONFIDENCE'; end if;

  if lower(coalesce(p_reading_method,''))='photo' then
    if p_image_url is null or p_ai_extracted_value is null or p_ai_confidence is null or p_ai_model is null then raise exception 'PHOTO_OCR_REQUIRED'; end if;
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
    p_ai_confidence,p_ai_model,p_detected_meter_number,'approved',false,null,p_gps_lat,p_gps_lng,
    p_gps_accuracy,'synced',(select p.full_name from public.profiles p where p.id=(select auth.uid())),
    p_notes,p_client_capture_id
  )
  returning * into v_reading;

  update public.meters set last_reading=p_reading_value,last_reading_date=v_reading_date,updated_at=now() where id=p_meter_id;

  v_period_start:=coalesce((v_previous_date at time zone 'Asia/Aden')::date+1,date_trunc('month',v_reading_date at time zone 'Asia/Aden')::date);
  perform private.mizan_issue_invoice_for_reading(v_reading.id,v_period_start,(v_reading_date at time zone 'Asia/Aden')::date);

  insert into public.audit_logs(table_name,record_id,action,user_id,actor_user_id,project_id,entity_type,entity_id,reason,result,before_data,after_data)
  values(
    'meter_readings',v_reading.id,'MRX_CAPTURE',(select auth.uid()),(select auth.uid()),v_project_id,
    'meter_reading',v_reading.id,
    case when lower(coalesce(p_reading_method,''))='manual_exception' then p_notes else null end,'accepted',
    jsonb_build_object('previous_reading',v_previous,'client_capture_id',p_client_capture_id),
    jsonb_build_object('reading_value',p_reading_value,'reading_method',p_reading_method,'reading_date',v_reading_date,
      'ai_confidence',p_ai_confidence,'ai_model',p_ai_model,'detected_serial_number',p_detected_meter_number,
      'gps_lat',p_gps_lat,'gps_lng',p_gps_lng,'gps_accuracy',p_gps_accuracy,'client_capture_id',p_client_capture_id)
  );
  return v_reading;
end;
$function$;

revoke execute on function public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text) from public,anon;
grant execute on function public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text) to authenticated;

create or replace function public.mizan_record_payment(
  p_invoice_id uuid,p_amount numeric,p_payment_method text default 'cash',
  p_reference_number text default null,p_notes text default null,p_client_payment_id uuid default null
)
returns public.payments language plpgsql security definer set search_path=''
as $function$
declare inv public.invoices%rowtype; pay public.payments%rowtype; pending_amount numeric; available_balance numeric; v_collector_name text;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into inv from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  if not private.mizan_has_permission('collection.record') or not private.mizan_can_write_project(inv.project_id,'payments','insert') then raise exception 'COLLECTION_FORBIDDEN'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
  if p_client_payment_id is not null then
    select * into pay from public.payments where client_payment_id=p_client_payment_id limit 1;
    if found then return pay; end if;
  end if;
  if p_reference_number is not null then
    select * into pay from public.payments where project_id=inv.project_id and reference_number=p_reference_number limit 1;
    if found then return pay; end if;
  end if;
  select coalesce(sum(p.amount),0) into pending_amount from public.payments p where p.invoice_id=inv.id and p.approval_status='pending';
  available_balance:=greatest(coalesce(inv.grand_total,0)-coalesce(inv.amount_paid,0)-pending_amount,0);
  if p_amount>available_balance then raise exception 'PAYMENT_EXCEEDS_AVAILABLE_BALANCE'; end if;
  select p.full_name into v_collector_name from public.profiles p where p.id=(select auth.uid());
  insert into public.payments(project_id,invoice_id,customer_id,receipt_number,amount,payment_method,collector_name,reference_number,notes,approval_status,recorded_by,client_payment_id)
  values(inv.project_id,inv.id,inv.customer_id,public.next_seq_number('RCP'),p_amount,coalesce(nullif(p_payment_method,''),'cash'),v_collector_name,p_reference_number,p_notes,'pending',(select auth.uid()),p_client_payment_id)
  returning * into pay;
  insert into public.audit_logs(table_name,record_id,action,user_id,actor_user_id,project_id,entity_type,entity_id,reason,result,before_data,after_data)
  values('payments',pay.id,'PAYMENT_RECORDED',(select auth.uid()),(select auth.uid()),inv.project_id,'payment',pay.id,p_notes,'pending_approval',
    jsonb_build_object('invoice_id',inv.id,'balance',inv.balance),
    jsonb_build_object('amount',pay.amount,'receipt_number',pay.receipt_number,'approval_status',pay.approval_status,'recorded_by',pay.recorded_by,'collector_name',pay.collector_name,'client_payment_id',pay.client_payment_id));
  return pay;
exception when unique_violation then
  if p_client_payment_id is not null then select * into pay from public.payments where client_payment_id=p_client_payment_id limit 1; if found then return pay; end if; end if;
  if p_reference_number is not null then select * into pay from public.payments where project_id=inv.project_id and reference_number=p_reference_number limit 1; if found then return pay; end if; end if;
  raise;
end;
$function$;

revoke execute on function public.mizan_record_payment(uuid,numeric,text,text,text) from public,anon;
revoke execute on function public.mizan_record_payment(uuid,numeric,text,text,text,uuid) from public,anon;
grant execute on function public.mizan_record_payment(uuid,numeric,text,text,text,uuid) to authenticated;
