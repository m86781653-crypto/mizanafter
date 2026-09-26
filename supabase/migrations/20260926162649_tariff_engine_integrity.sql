create extension if not exists btree_gist;

alter table public.tariffs
  add constraint tariffs_fixed_fee_nonnegative check (coalesce(fixed_fee,0) >= 0),
  add constraint tariffs_effective_range_valid check (effective_to is null or effective_to >= effective_from);

alter table public.tariff_tiers
  add constraint tariff_tiers_from_nonnegative check (from_m3 >= 0),
  add constraint tariff_tiers_to_after_from check (to_m3 is null or to_m3 > from_m3),
  add constraint tariff_tiers_price_nonnegative check (price_per_m3 >= 0);

alter table public.tariff_tiers
  add constraint tariff_tiers_no_overlap
  exclude using gist (tariff_id with =, numrange(from_m3, coalesce(to_m3,'infinity'::numeric), '[)') with &&);

create or replace function private.mizan_calculate_consumption_fee(p_tariff_id uuid, p_consumption numeric)
returns numeric language plpgsql security definer set search_path to '' as $$
declare tier record; expected_from numeric:=0; remaining numeric:=p_consumption; used numeric; fee numeric:=0; saw_open_ended boolean:=false;
begin
 if p_tariff_id is null then raise exception 'TARIFF_REQUIRED'; end if;
 if p_consumption is null or p_consumption < 0 then raise exception 'INVALID_CONSUMPTION'; end if;
 for tier in select from_m3,to_m3,price_per_m3 from public.tariff_tiers where tariff_id=p_tariff_id order by from_m3,created_at,id loop
  if tier.from_m3 <> expected_from then
   if tier.from_m3 > expected_from then raise exception 'TARIFF_TIER_GAP'; else raise exception 'TARIFF_TIER_OVERLAP'; end if;
  end if;
  if saw_open_ended then raise exception 'TARIFF_TIER_AFTER_OPEN_ENDED'; end if;
  if tier.price_per_m3 < 0 then raise exception 'TARIFF_TIER_PRICE_INVALID'; end if;
  if tier.to_m3 is null then used:=remaining; saw_open_ended:=true;
  else used:=least(remaining,tier.to_m3-tier.from_m3); expected_from:=tier.to_m3; end if;
  if used > 0 then fee:=fee+used*tier.price_per_m3; remaining:=remaining-used; end if;
  exit when remaining <= 0;
 end loop;
 if remaining > 0 then raise exception 'TARIFF_COVERAGE_INCOMPLETE'; end if;
 return fee;
end; $$;
revoke all on function private.mizan_calculate_consumption_fee(uuid,numeric) from public,anon,authenticated;

create or replace function public.mizan_create_invoice(p_project_id uuid,p_customer_id uuid,p_meter_id uuid,p_period_start date,p_period_end date)
returns public.invoices language plpgsql security definer set search_path to '' as $$
declare v_invoice public.invoices; v_meter public.meters; v_customer public.customers; v_tariff public.tariffs; v_reading public.meter_readings; v_consumption numeric; v_consumption_fee numeric; v_fixed_fee numeric:=0; v_total numeric:=0;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_period_start is null or p_period_end is null or p_period_end<p_period_start then raise exception 'INVALID_BILLING_PERIOD'; end if;
 if not private.mizan_can_write_project(p_project_id,'invoices','insert') then raise exception 'INVOICE_WRITE_FORBIDDEN'; end if;
 select * into v_meter from public.meters where id=p_meter_id and project_id=p_project_id for update; if not found then raise exception 'METER_NOT_FOUND'; end if;
 select * into v_customer from public.customers where id=p_customer_id and project_id=p_project_id and status='active' for update; if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
 if v_meter.customer_id is distinct from p_customer_id then raise exception 'METER_CUSTOMER_MISMATCH'; end if;
 select * into v_reading from public.meter_readings where meter_id=p_meter_id and project_id=p_project_id and customer_id=p_customer_id and status='approved' order by reading_date desc,created_at desc,id desc limit 1; if not found then raise exception 'APPROVED_MRX_READING_REQUIRED'; end if;
 if exists(select 1 from public.invoices where source_reading_id=v_reading.id) then select * into v_invoice from public.invoices where source_reading_id=v_reading.id limit 1; return v_invoice; end if;
 v_consumption:=coalesce(v_reading.consumption,v_reading.reading_value-v_reading.previous_reading); if v_consumption is null or v_consumption<=0 then raise exception 'NO_NEW_CONSUMPTION'; end if;
 select * into v_tariff from public.tariffs where project_id=p_project_id and customer_type=v_customer.customer_type and is_active=true and effective_from<=p_period_end and (effective_to is null or effective_to>=p_period_start) order by effective_from desc,version desc limit 1; if not found then raise exception 'ACTIVE_TARIFF_NOT_FOUND'; end if;
 v_fixed_fee:=coalesce(v_tariff.fixed_fee,0); v_consumption_fee:=private.mizan_calculate_consumption_fee(v_tariff.id,v_consumption); v_total:=v_fixed_fee+v_consumption_fee;
 insert into public.invoices(project_id,customer_id,meter_id,invoice_number,billing_period_start,billing_period_end,previous_reading,current_reading,consumption_m3,fixed_fee,consumption_fee,total_amount,grand_total,amount_paid,balance,status,source_reading_id) values(p_project_id,p_customer_id,p_meter_id,null,p_period_start,p_period_end,v_reading.previous_reading,v_reading.reading_value,v_consumption,v_fixed_fee,v_consumption_fee,v_total,v_total,0,v_total,'unpaid',v_reading.id) returning * into v_invoice;
 update public.meters set last_reading=v_reading.reading_value,last_reading_date=v_reading.reading_date where id=p_meter_id;
 perform private.mizan_write_audit(p_project_id,'INVOICE_CREATED','invoice',v_invoice.id,null,jsonb_build_object('customer_id',p_customer_id,'meter_id',p_meter_id,'reading_id',v_reading.id,'reading_value',v_reading.reading_value,'previous_reading',v_reading.previous_reading,'consumption_m3',v_consumption,'grand_total',v_total),null,'success');
 return v_invoice;
end; $$;
revoke execute on function public.mizan_create_invoice(uuid,uuid,uuid,date,date) from anon; grant execute on function public.mizan_create_invoice(uuid,uuid,uuid,date,date) to authenticated;
