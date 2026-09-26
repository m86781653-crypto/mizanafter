-- Root fix: invoice consumption must use the reading immediately before the
-- latest approved reading, not meters.last_reading (MRX updates that field).
-- This preserves the meter baseline while making invoice issuance compatible
-- with the approved-reading workflow and prevents invoicing the same reading twice.

create or replace function public.mizan_create_invoice(
  p_project_id uuid,
  p_customer_id uuid,
  p_meter_id uuid,
  p_period_start date,
  p_period_end date
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_meter public.meters;
  v_customer public.customers;
  v_tariff public.tariffs;
  v_reading public.meter_readings;
  v_previous_reading numeric;
  v_consumption numeric;
  v_consumption_fee numeric := 0;
  v_fixed_fee numeric := 0;
  v_total numeric := 0;
  v_remaining numeric;
  v_from numeric;
  v_to numeric;
  v_used numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'INVALID_BILLING_PERIOD';
  end if;
  if not private.mizan_can_write_project(p_project_id, 'invoices', 'insert') then
    raise exception 'INVOICE_WRITE_FORBIDDEN';
  end if;

  select * into v_meter
  from public.meters
  where id = p_meter_id and project_id = p_project_id
  for update;
  if not found then raise exception 'METER_NOT_FOUND'; end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id and project_id = p_project_id and status = 'active'
  for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if v_meter.customer_id is distinct from p_customer_id then raise exception 'METER_CUSTOMER_MISMATCH'; end if;

  -- MRX records accepted readings as approved and advances meters.last_reading.
  -- Therefore the invoice baseline must come from the immediately preceding
  -- accepted reading, with the meter's stored baseline only as the first-reading fallback.
  select * into v_reading
  from public.meter_readings
  where meter_id = p_meter_id
    and project_id = p_project_id
    and status = 'approved'
  order by reading_date desc, created_at desc
  limit 1;

  if not found then raise exception 'APPROVED_READING_REQUIRED'; end if;

  if exists (
    select 1 from public.invoices i
    where i.project_id = p_project_id
      and i.meter_id = p_meter_id
      and i.current_reading = v_reading.reading_value
  ) then
    raise exception 'READING_ALREADY_INVOICED';
  end if;

  select mr.reading_value into v_previous_reading
  from public.meter_readings mr
  where mr.meter_id = p_meter_id
    and mr.project_id = p_project_id
    and mr.status = 'approved'
    and (mr.reading_date, mr.created_at, mr.id) < (v_reading.reading_date, v_reading.created_at, v_reading.id)
  order by mr.reading_date desc, mr.created_at desc, mr.id desc
  limit 1;

  v_previous_reading := coalesce(v_previous_reading, v_meter.last_reading);

  if v_reading.reading_value < v_previous_reading then
    raise exception 'READING_DECREASE';
  end if;

  v_consumption := v_reading.reading_value - v_previous_reading;
  if v_consumption <= 0 then
    raise exception 'NO_NEW_CONSUMPTION';
  end if;

  select * into v_tariff
  from public.tariffs
  where project_id = p_project_id
    and customer_type = v_customer.customer_type
    and is_active = true
    and effective_from <= p_period_end
    and (effective_to is null or effective_to >= p_period_start)
  order by effective_from desc, version desc
  limit 1;
  if not found then raise exception 'ACTIVE_TARIFF_NOT_FOUND'; end if;

  v_fixed_fee := coalesce(v_tariff.fixed_fee, 0);
  v_remaining := v_consumption;

  for v_from, v_to in
    select t.from_m3, t.to_m3
    from public.tariff_tiers t
    where t.tariff_id = v_tariff.id
    order by t.from_m3, t.created_at, t.id
  loop
    exit when v_remaining <= 0;
    v_used := least(
      v_remaining,
      greatest(coalesce(v_to, v_from + v_remaining) - v_from, 0)
    );
    if v_used > 0 then
      select v_consumption_fee + (v_used * t.price_per_m3)
      into v_consumption_fee
      from public.tariff_tiers t
      where t.tariff_id = v_tariff.id
        and t.from_m3 = v_from
        and t.to_m3 is not distinct from v_to
      order by t.created_at desc, t.id desc
      limit 1;
      v_remaining := v_remaining - v_used;
    end if;
  end loop;

  if v_remaining > 0 then raise exception 'TARIFF_COVERAGE_INCOMPLETE'; end if;

  v_total := v_fixed_fee + v_consumption_fee;

  insert into public.invoices (
    project_id, customer_id, meter_id, invoice_number,
    billing_period_start, billing_period_end,
    previous_reading, current_reading, consumption_m3,
    fixed_fee, consumption_fee, total_amount, grand_total,
    amount_paid, balance, status
  ) values (
    p_project_id, p_customer_id, p_meter_id, null,
    p_period_start, p_period_end,
    v_previous_reading, v_reading.reading_value, v_consumption,
    v_fixed_fee, v_consumption_fee, v_total, v_total,
    0, v_total, 'unpaid'
  )
  returning * into v_invoice;

  perform private.mizan_write_audit(
    p_project_id, 'INVOICE_CREATED', 'invoice', v_invoice.id, null,
    jsonb_build_object(
      'customer_id', p_customer_id, 'meter_id', p_meter_id,
      'reading_id', v_reading.id, 'reading_value', v_reading.reading_value,
      'previous_reading', v_previous_reading, 'consumption_m3', v_consumption,
      'grand_total', v_total
    ), null, 'success'
  );

  return v_invoice;
end;
$$;

revoke all on function public.mizan_create_invoice(uuid,uuid,uuid,date,date) from public, anon, authenticated;
grant execute on function public.mizan_create_invoice(uuid,uuid,uuid,date,date) to authenticated;
revoke insert, update, delete on public.invoices from anon, authenticated;
