-- Reconstruct the governed database objects required for clean-room reproducibility.
-- This migration restores objects that existed in production but were absent from the
-- repository migration chain.

create table if not exists public.mizan_role_permissions (
  role_code text not null,
  permission_code text not null,
  primary key (role_code, permission_code)
);

insert into public.mizan_role_permissions(role_code, permission_code) values
('platform_admin','audit.read'),('platform_admin','audit.write_system'),('platform_admin','billing.manage'),('platform_admin','collection.record'),('platform_admin','customer.manage'),('platform_admin','data.exception'),('platform_admin','maintenance.execute'),('platform_admin','maintenance.manage'),('platform_admin','meter.capture'),('platform_admin','meter.exception'),('platform_admin','project.manage'),('platform_admin','project.read'),
('tenant_manager','audit.read'),('tenant_manager','audit.write_system'),('tenant_manager','billing.manage'),('tenant_manager','collection.record'),('tenant_manager','customer.manage'),('tenant_manager','data.exception'),('tenant_manager','maintenance.execute'),('tenant_manager','maintenance.manage'),('tenant_manager','meter.capture'),('tenant_manager','meter.exception'),('tenant_manager','project.manage'),('tenant_manager','project.read'),
('operations_officer','billing.manage'),('operations_officer','customer.manage'),('operations_officer','maintenance.execute'),('operations_officer','maintenance.manage'),('operations_officer','meter.capture'),('operations_officer','meter.exception'),('operations_officer','project.manage'),('operations_officer','project.read'),
('meter_reader','meter.capture'),('meter_reader','project.read'),
('collection_officer','collection.record'),('collection_officer','project.read'),
('maintenance_officer','maintenance.manage'),('maintenance_officer','project.read'),
('technician','maintenance.execute'),('technician','project.read'),
('data_exception_officer','data.exception'),('data_exception_officer','meter.exception'),('data_exception_officer','project.read'),
('viewer','project.read'),
('read_only','project.read'),
('project_manager','audit.read'),('project_manager','audit.write_system'),('project_manager','billing.manage'),('project_manager','collection.record'),('project_manager','customer.manage'),('project_manager','data.exception'),('project_manager','maintenance.execute'),('project_manager','maintenance.manage'),('project_manager','meter.capture'),('project_manager','meter.exception'),('project_manager','project.manage'),('project_manager','project.read'),
('collector','collection.record'),('collector','project.read'),
('maintenance_tech','maintenance.execute'),('maintenance_tech','project.read'),
('super_admin','audit.read'),('super_admin','audit.write_system'),('super_admin','billing.manage'),('super_admin','collection.record'),('super_admin','customer.manage'),('super_admin','data.exception'),('super_admin','maintenance.execute'),('super_admin','maintenance.manage'),('super_admin','meter.capture'),('super_admin','meter.exception'),('super_admin','project.manage'),('super_admin','project.read')
on conflict do nothing;

alter table public.mizan_role_permissions enable row level security;
revoke all on public.mizan_role_permissions from anon, authenticated;

create or replace function public.mizan_create_invoice(
  p_project_id uuid, p_customer_id uuid, p_meter_id uuid, p_current_reading numeric,
  p_period_start date, p_period_end date
) returns public.invoices
language plpgsql security definer set search_path to ''
as $function$
declare
  c public.customers%rowtype; m public.meters%rowtype; t public.tariffs%rowtype;
  r public.meter_readings%rowtype; tier record; inv public.invoices%rowtype;
  prev numeric; consumption numeric; fixed_fee numeric; consumption_fee numeric := 0;
  remaining numeric; used_in_tier numeric; total numeric; invoice_number text;
  due_date date; prior_arrears numeric := 0;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.mizan_has_permission('billing.manage')
     or not private.mizan_can_write_project(p_project_id,'invoices','insert')
  then raise exception 'BILLING_FORBIDDEN'; end if;

  select * into c from public.customers where id=p_customer_id and project_id=p_project_id for share;
  if not found or c.status<>'active' then raise exception 'CUSTOMER_NOT_FOUND'; end if;

  select * into m from public.meters where id=p_meter_id and project_id=p_project_id and customer_id=p_customer_id for update;
  if not found or m.status<>'active' then raise exception 'METER_NOT_FOUND'; end if;

  select * into r from public.meter_readings
    where meter_id=p_meter_id and project_id=p_project_id and customer_id=p_customer_id and status='approved'
    order by reading_date desc,created_at desc limit 1 for share;
  if not found then raise exception 'APPROVED_MRX_READING_REQUIRED'; end if;
  if r.reading_value<>p_current_reading then raise exception 'CURRENT_READING_MUST_MATCH_MRX'; end if;

  if exists(select 1 from public.invoices where source_reading_id=r.id) then
    select * into inv from public.invoices where source_reading_id=r.id;
    return inv;
  end if;

  prev:=r.previous_reading; consumption:=r.consumption;
  select * into t from public.tariffs
   where project_id=p_project_id and customer_type=c.customer_type and is_active=true
     and effective_from<=coalesce(p_period_end,current_date)
     and (effective_to is null or effective_to>=coalesce(p_period_start,current_date))
   order by effective_from desc,version desc limit 1;
  if not found then raise exception 'ACTIVE_TARIFF_NOT_FOUND'; end if;

  fixed_fee:=coalesce(t.fixed_fee,0); remaining:=consumption;
  for tier in select from_m3,to_m3,price_per_m3 from public.tariff_tiers where tariff_id=t.id order by from_m3 loop
    exit when remaining<=0;
    used_in_tier:=case when tier.to_m3 is null then remaining
      else least(remaining,greatest(tier.to_m3-tier.from_m3,0)) end;
    consumption_fee:=consumption_fee+used_in_tier*tier.price_per_m3;
    remaining:=remaining-used_in_tier;
  end loop;
  if remaining>0 then raise exception 'TARIFF_TIERS_INCOMPLETE'; end if;

  select coalesce(sum(greatest(i.balance,0)),0) into prior_arrears from public.invoices i
    where i.customer_id=p_customer_id and i.project_id=p_project_id
      and i.status in('unpaid','partial','overdue');
  total:=fixed_fee+consumption_fee;
  invoice_number:=public.next_seq_number('INV');
  due_date:=coalesce(p_period_end,current_date)+15;

  insert into public.invoices(
    project_id,customer_id,meter_id,invoice_number,billing_period_start,billing_period_end,
    previous_reading,current_reading,consumption_m3,fixed_fee,consumption_fee,total_amount,
    previous_balance,grand_total,amount_paid,balance,status,due_date,source_reading_id
  ) values (
    p_project_id,p_customer_id,p_meter_id,invoice_number,p_period_start,p_period_end,
    prev,p_current_reading,consumption,fixed_fee,consumption_fee,total,prior_arrears,
    total+prior_arrears,0,total+prior_arrears,'unpaid',due_date,r.id
  ) returning * into inv;
  return inv;
end;
$function$;

create or replace function public.mizan_record_payment(
  p_invoice_id uuid, p_amount numeric, p_payment_method text default 'cash',
  p_reference_number text default null, p_notes text default null
) returns public.payments
language plpgsql security definer set search_path to ''
as $function$
declare
  inv public.invoices%rowtype; pay public.payments%rowtype;
  new_paid numeric; new_balance numeric; new_status text;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into inv from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  if not private.mizan_has_permission('collection.record')
     or not private.mizan_can_write_project(inv.project_id,'payments','insert')
  then raise exception 'COLLECTION_FORBIDDEN'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;

  if p_reference_number is not null then
    select * into pay from public.payments
      where project_id=inv.project_id and reference_number=p_reference_number limit 1;
    if found then return pay; end if;
  end if;

  if p_amount>coalesce(inv.balance,0) then raise exception 'PAYMENT_EXCEEDS_BALANCE'; end if;
  new_paid:=coalesce(inv.amount_paid,0)+p_amount;
  new_balance:=greatest(coalesce(inv.grand_total,0)-new_paid,0);
  new_status:=case when new_balance=0 then 'paid' else 'partial' end;

  insert into public.payments(
    project_id,invoice_id,customer_id,receipt_number,amount,payment_method,
    collector_name,reference_number,notes
  ) values (
    inv.project_id,inv.id,inv.customer_id,public.next_seq_number('RCP'),p_amount,
    coalesce(nullif(p_payment_method,''),'cash'),null,p_reference_number,p_notes
  ) returning * into pay;

  update public.invoices set amount_paid=new_paid,balance=new_balance,status=new_status,updated_at=now()
   where id=inv.id;
  return pay;
exception when unique_violation then
  if p_reference_number is not null then
    select * into pay from public.payments where project_id=inv.project_id
      and reference_number=p_reference_number limit 1;
    if found then return pay; end if;
  end if;
  raise;
end;
$function$;

create or replace function public.mrx_capture_meter_reading(
  p_meter_id uuid, p_reading_value numeric, p_reading_date timestamptz default null,
  p_reading_method text default 'photo', p_image_url text default null,
  p_gps_lat numeric default null, p_gps_lng numeric default null, p_gps_accuracy numeric default null,
  p_ai_extracted_value numeric default null, p_ai_confidence numeric default null,
  p_ai_model text default null, p_notes text default null,
  p_client_capture_id uuid default null, p_detected_meter_number text default null
) returns public.meter_readings
language plpgsql security definer set search_path to ''
as $function$
declare
  v_meter public.meters%rowtype; v_previous numeric; v_reading_date timestamptz;
  v_project_id uuid; v_customer_id uuid; v_reading public.meter_readings%rowtype;
  v_expected_meter text; v_detected_meter text;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reading_value is null or p_reading_value<0 then raise exception 'INVALID_READING_VALUE'; end if;

  select * into v_meter from public.meters where id=p_meter_id for update;
  if not found then raise exception 'METER_NOT_FOUND'; end if;
  v_project_id:=v_meter.project_id; v_customer_id:=v_meter.customer_id;
  v_expected_meter:=lower(regexp_replace(coalesce(v_meter.meter_number,''),'[^a-zA-Z0-9]+','','g'));
  v_detected_meter:=lower(regexp_replace(coalesce(p_detected_meter_number,''),'[^a-zA-Z0-9]+','','g'));

  if not private.mizan_has_permission('meter.capture')
     or not private.mizan_can_write_project(v_project_id,'meter_readings','insert')
  then raise exception 'METER_CAPTURE_FORBIDDEN'; end if;
  if v_meter.status<>'active' then raise exception 'METER_NOT_ACTIVE'; end if;

  if p_client_capture_id is not null then
    select * into v_reading from public.meter_readings
      where client_capture_id=p_client_capture_id and meter_id=p_meter_id limit 1;
    if found then return v_reading; end if;
  end if;

  v_reading_date:=coalesce(p_reading_date,now());
  select mr.reading_value into v_previous from public.meter_readings mr
    where mr.meter_id=p_meter_id and mr.status not in ('void','exception')
    order by mr.reading_date desc,mr.created_at desc limit 1;
  v_previous:=coalesce(v_previous,v_meter.last_reading,0);
  if p_reading_value<v_previous then raise exception 'READING_DECREASE_REQUIRES_EXCEPTION'; end if;
  if p_ai_confidence is not null and (p_ai_confidence<0 or p_ai_confidence>100) then raise exception 'INVALID_AI_CONFIDENCE'; end if;

  if lower(coalesce(p_reading_method,''))='photo' then
    if p_image_url is null or p_ai_extracted_value is null or p_ai_confidence is null or p_ai_model is null
      then raise exception 'PHOTO_OCR_REQUIRED'; end if;
    if p_ai_confidence<70 then raise exception 'OCR_CONFIDENCE_TOO_LOW'; end if;
    if abs(p_reading_value-p_ai_extracted_value)>0.01 then raise exception 'READING_MUST_MATCH_OCR'; end if;
    if v_expected_meter='' or v_detected_meter='' or v_expected_meter<>v_detected_meter
      then raise exception 'METER_IDENTITY_MISMATCH'; end if;
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
  ) values (
    p_meter_id,v_project_id,v_customer_id,p_reading_value,v_previous,p_reading_value-v_previous,
    v_reading_date,coalesce(nullif(p_reading_method,''),'photo'),p_image_url,p_ai_extracted_value,
    p_ai_confidence,p_ai_model,p_detected_meter_number,'approved',false,null,p_gps_lat,p_gps_lng,
    p_gps_accuracy,'synced',null,p_notes,p_client_capture_id
  ) returning * into v_reading;

  update public.meters set last_reading=p_reading_value,last_reading_date=v_reading_date,updated_at=now()
    where id=p_meter_id;

  insert into public.audit_logs(
    table_name,record_id,action,user_id,actor_user_id,project_id,entity_type,entity_id,reason,result,before_data,after_data
  ) values (
    'meter_readings',v_reading.id,'MRX_CAPTURE',(select auth.uid()),(select auth.uid()),v_project_id,
    'meter_reading',v_reading.id,
    case when lower(coalesce(p_reading_method,''))='manual_exception' then p_notes else null end,
    'accepted',
    jsonb_build_object('previous_reading',v_previous,'client_capture_id',p_client_capture_id),
    jsonb_build_object('reading_value',p_reading_value,'reading_method',p_reading_method,
      'reading_date',v_reading_date,'ai_confidence',p_ai_confidence,'ai_model',p_ai_model,
      'detected_meter_number',p_detected_meter_number,'gps_lat',p_gps_lat,'gps_lng',p_gps_lng,
      'gps_accuracy',p_gps_accuracy,'client_capture_id',p_client_capture_id)
  );
  return v_reading;
end;
$function$;

create or replace function public.mizan_create_subtenant(
  p_name_ar text, p_name_en text default null, p_timezone text default 'Asia/Aden'
) returns uuid language plpgsql security definer set search_path to ''
as $function$
declare caller_tenant_id uuid; new_tenant_id uuid; caller_role text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  caller_tenant_id:=private.mizan_user_tenant_id(); caller_role:=private.mizan_user_role();
  if caller_tenant_id is null or caller_role<>'tenant_manager' then raise exception 'TENANT_CREATE_FORBIDDEN' using errcode='42501'; end if;
  if not exists(select 1 from public.tenants where id=caller_tenant_id and tenant_type='main_tenant' and status='active')
    then raise exception 'MAIN_TENANT_REQUIRED' using errcode='42501'; end if;
  if nullif(trim(p_name_ar),'') is null then raise exception 'TENANT_NAME_REQUIRED' using errcode='22023'; end if;
  if exists(select 1 from public.tenants where parent_tenant_id=caller_tenant_id
    and lower(trim(name_ar))=lower(trim(p_name_ar)) and status<>'archived')
    then raise exception 'TENANT_NAME_EXISTS' using errcode='23505'; end if;
  insert into public.tenants(parent_tenant_id,name_ar,name_en,tenant_type,timezone,status)
    values(caller_tenant_id,trim(p_name_ar),nullif(trim(p_name_en),''),'sub_tenant',
      coalesce(nullif(trim(p_timezone),''),'Asia/Aden'),'active')
    returning id into new_tenant_id;
  insert into public.audit_logs(table_name,record_id,action,user_id,actor_user_id,entity_type,entity_id,new_values,result,reason)
    values('tenants',new_tenant_id,'CREATE',auth.uid(),auth.uid(),'tenant',new_tenant_id,
      jsonb_build_object('parent_tenant_id',caller_tenant_id,'name_ar',trim(p_name_ar),
        'tenant_type','sub_tenant','status','active'),'accepted','main_tenant_manager_created_subtenant');
  return new_tenant_id;
end;
$function$;

revoke execute on function public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) from public,anon,authenticated;
revoke execute on function public.mizan_record_payment(uuid,numeric,text,text,text) from public,anon,authenticated;
revoke execute on function public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text) from public,anon;
revoke execute on function public.mizan_create_subtenant(text,text,text) from public,anon,authenticated;
grant execute on function public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) to service_role;
grant execute on function public.mizan_record_payment(uuid,numeric,text,text,text) to service_role;
grant execute on function public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['assets','customers','faults','field_tasks','invoices','kpi_snapshots','maintenance_work_orders','meter_readings','meters','notifications','payments','pumps','tanks','tariffs','wells'] loop
    execute format('drop policy if exists mizan_tenant_update on public.%I',t);
    execute format('create policy mizan_tenant_update on public.%I for update to authenticated using ((select private.mizan_can_write_project(project_id,%L,%L))) with check ((select private.mizan_can_write_project(project_id,%L,%L)))',t,t,'update',t,'update');
  end loop;
end $$;
