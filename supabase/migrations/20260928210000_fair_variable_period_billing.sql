-- MIZAN AI: fair variable-period billing and non-approval meter capture
-- Reference policy: actual days between readings, daily allowance, prorated fixed charges,
-- prorated tariff tiers, first-reading baseline from service start, and collection-only approval.

begin;

alter table public.tariffs
  add column if not exists reference_period_days integer not null default 30;

alter table public.invoices
  add column if not exists billing_days integer not null default 30,
  add column if not exists allowance_m3 numeric not null default 0,
  add column if not exists household_members integer not null default 0,
  add column if not exists fixed_fee_prorated numeric not null default 0,
  add column if not exists calculation_snapshot jsonb not null default '{}'::jsonb;

alter table public.tariffs
  drop constraint if exists tariffs_reference_period_days_positive;
alter table public.tariffs
  add constraint tariffs_reference_period_days_positive
  check (reference_period_days > 0);

create table if not exists private.customer_household_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  effective_from date not null,
  effective_to date,
  household_members integer not null default 0,
  reason text,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint customer_household_history_range_valid
    check (effective_to is null or effective_to >= effective_from),
  constraint customer_household_history_members_nonnegative
    check (household_members >= 0)
);

create index if not exists idx_customer_household_history_lookup
  on private.customer_household_history(customer_id, effective_from desc);

create unique index if not exists ux_customer_household_history_start
  on private.customer_household_history(customer_id, effective_from);

revoke all on private.customer_household_history from public, anon, authenticated;
grant all on private.customer_household_history to service_role;

create or replace function private.mizan_household_history_sync()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_effective_from date;
  v_members integer;
  v_previous record;
begin
  if tg_op = 'INSERT' then
    v_effective_from := coalesce(new.connection_date, (new.created_at at time zone 'Asia/Aden')::date, current_date);
    v_members := greatest(coalesce(new.household_members, 0), 0);

    insert into private.customer_household_history(
      customer_id, project_id, effective_from, household_members, reason, changed_by
    )
    values(
      new.id, new.project_id, v_effective_from, v_members, 'INITIAL_CUSTOMER_RECORD', (select auth.uid())
    )
    on conflict (customer_id, effective_from) do update
      set household_members = excluded.household_members,
          project_id = excluded.project_id;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (
       new.household_members is distinct from old.household_members
       or new.connection_date is distinct from old.connection_date
     )
  then
    v_effective_from := case
      when new.connection_date is distinct from old.connection_date
        and new.connection_date is not null
        and new.connection_date <= current_date
        then new.connection_date
      else current_date
    end;
    v_members := greatest(coalesce(new.household_members, 0), 0);

    select *
      into v_previous
    from private.customer_household_history h
    where h.customer_id = new.id
    order by h.effective_from desc, h.created_at desc
    limit 1;

    if v_previous is not null and v_previous.effective_from < v_effective_from then
      update private.customer_household_history
      set effective_to = v_effective_from - 1
      where id = v_previous.id;
    elsif v_previous is not null and v_previous.effective_from = v_effective_from then
      update private.customer_household_history
      set household_members = v_members,
          project_id = new.project_id,
          reason = 'CUSTOMER_PROFILE_CHANGE',
          changed_by = (select auth.uid())
      where id = v_previous.id;
      return new;
    end if;

    insert into private.customer_household_history(
      customer_id, project_id, effective_from, household_members, reason, changed_by
    )
    values(
      new.id, new.project_id, v_effective_from, v_members, 'CUSTOMER_PROFILE_CHANGE', (select auth.uid())
    )
    on conflict (customer_id, effective_from) do update
      set household_members = excluded.household_members,
          project_id = excluded.project_id,
          reason = excluded.reason,
          changed_by = excluded.changed_by;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_customer_household_history on public.customers;
create trigger trg_customer_household_history
after insert or update of household_members, connection_date on public.customers
for each row execute function private.mizan_household_history_sync();

-- Backfill only what is knowable from the current production record.
-- Historical household changes cannot be reconstructed without source evidence.
insert into private.customer_household_history(
  customer_id, project_id, effective_from, household_members, reason
)
select
  c.id,
  c.project_id,
  coalesce(c.connection_date, (c.created_at at time zone 'Asia/Aden')::date, current_date),
  greatest(coalesce(c.household_members,0),0),
  'BACKFILL_CURRENT_RECORD'
from public.customers c
on conflict (customer_id, effective_from) do nothing;

create or replace function private.mizan_household_members_for_date(
  p_customer_id uuid,
  p_date date
)
returns integer
language sql
security definer
set search_path=''
stable
as $$
  select greatest(coalesce((
    select h.household_members
    from private.customer_household_history h
    where h.customer_id = p_customer_id
      and h.effective_from <= p_date
      and (h.effective_to is null or h.effective_to >= p_date)
    order by h.effective_from desc, h.created_at desc
    limit 1
  ), 0), 0);
$$;

revoke all on function private.mizan_household_members_for_date(uuid,date) from public, anon, authenticated;

create or replace function private.mizan_calculate_consumption_fee_for_period(
  p_tariff_id uuid,
  p_consumption numeric,
  p_days integer
)
returns numeric
language plpgsql
security definer
set search_path=''
as $$
declare
  tier record;
  v_reference_days integer;
  v_scale numeric;
  v_from numeric;
  v_to numeric;
  v_used numeric;
  v_remaining numeric := greatest(coalesce(p_consumption,0),0);
  v_fee numeric := 0;
  v_expected_from numeric := 0;
begin
  if p_tariff_id is null then raise exception 'TARIFF_REQUIRED'; end if;
  if p_days is null or p_days < 1 then raise exception 'INVALID_BILLING_DAYS'; end if;

  select reference_period_days into v_reference_days
  from public.tariffs
  where id = p_tariff_id;

  if not found or v_reference_days is null or v_reference_days < 1 then
    raise exception 'TARIFF_REFERENCE_PERIOD_INVALID';
  end if;

  v_scale := p_days::numeric / v_reference_days::numeric;

  for tier in
    select from_m3, to_m3, price_per_m3
    from public.tariff_tiers
    where tariff_id = p_tariff_id
    order by from_m3, created_at, id
  loop
    v_from := tier.from_m3 * v_scale;
    v_to := case when tier.to_m3 is null then null else tier.to_m3 * v_scale end;

    if v_from <> v_expected_from then
      if v_from > v_expected_from then raise exception 'TARIFF_TIER_GAP'; end if;
      raise exception 'TARIFF_TIER_OVERLAP';
    end if;

    if v_to is null then
      v_used := v_remaining;
    else
      v_used := least(v_remaining, greatest(v_to - v_from, 0));
    end if;

    if v_used > 0 then
      v_fee := v_fee + v_used * tier.price_per_m3;
      v_remaining := v_remaining - v_used;
    end if;

    if v_to is not null then
      v_expected_from := v_to;
    end if;

    exit when v_remaining <= 0;
  end loop;

  if v_remaining > 0 then raise exception 'TARIFF_COVERAGE_INCOMPLETE'; end if;
  return v_fee;
end;
$$;

revoke all on function private.mizan_calculate_consumption_fee_for_period(uuid,numeric,integer)
from public, anon, authenticated;

-- New billing engine.
-- The meter provides cumulative usage only. If a tariff changes inside a read interval,
-- the measured consumption is apportioned by actual days across tariff segments.
-- This is explicit in the invoice snapshot and avoids charging the whole interval
-- at the newer rate.
create or replace function private.mizan_issue_invoice_for_reading(
  p_reading_id uuid,
  p_period_start date,
  p_period_end date
)
returns public.invoices
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_reading public.meter_readings%rowtype;
  v_meter public.meters%rowtype;
  v_customer public.customers%rowtype;
  v_invoice public.invoices%rowtype;
  v_previous_date date;
  v_period_start date;
  v_period_end date;
  v_total_days integer;
  v_consumption numeric;
  v_remaining_consumption numeric;
  v_segment_start date;
  v_segment_end date;
  v_next_household_date date;
  v_next_tariff_date date;
  v_household_members integer;
  v_segment_days integer;
  v_segment_consumption numeric;
  v_allowance_m3 numeric;
  v_included_m3 numeric;
  v_tiered_m3 numeric;
  v_base_fee numeric;
  v_tiered_fee numeric;
  v_fixed_fee numeric;
  v_current_charge numeric := 0;
  v_arrears numeric := 0;
  v_grand_total numeric;
  v_tariff public.tariffs%rowtype;
  v_tariff_count integer;
  v_last_segment boolean;
  v_segments jsonb := '[]'::jsonb;
begin
  select * into v_reading
  from public.meter_readings
  where id = p_reading_id
  for update;

  if not found then raise exception 'READING_NOT_FOUND'; end if;

  if exists(select 1 from public.invoices where source_reading_id = p_reading_id) then
    select * into v_invoice
    from public.invoices
    where source_reading_id = p_reading_id
    limit 1;
    return v_invoice;
  end if;

  select * into v_meter
  from public.meters
  where id = v_reading.meter_id
    and project_id = v_reading.project_id
  for update;

  if not found then raise exception 'METER_NOT_FOUND'; end if;

  select * into v_customer
  from public.customers
  where id = v_reading.customer_id
    and project_id = v_reading.project_id
    and status = 'active'
  for update;

  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;

  v_consumption := greatest(coalesce(v_reading.consumption,0),0);

  select
    (mr.reading_date at time zone 'Asia/Aden')::date
  into v_previous_date
  from public.meter_readings mr
  where mr.meter_id = v_reading.meter_id
    and mr.reading_date < v_reading.reading_date
    and mr.status not in ('void','exception')
  order by mr.reading_date desc, mr.created_at desc, mr.id desc
  limit 1;

  v_period_end := coalesce(p_period_end, (v_reading.reading_date at time zone 'Asia/Aden')::date);

  if v_previous_date is not null then
    v_period_start := v_previous_date;
  else
    v_period_start := coalesce(
      p_period_start,
      v_customer.connection_date,
      v_meter.installation_date,
      v_period_end
    );
  end if;

  if v_period_start > v_period_end then
    raise exception 'INVALID_BILLING_PERIOD';
  end if;

  v_total_days := greatest(v_period_end - v_period_start, 1);

  select count(*) into v_tariff_count
  from public.tariffs t
  where t.project_id = v_reading.project_id
    and t.customer_type = coalesce(v_customer.customer_type,'residential')
    and t.is_active = true
    and t.effective_from <= v_period_end
    and (t.effective_to is null or t.effective_to >= v_period_start);

  if v_tariff_count = 0 then raise exception 'ACTIVE_TARIFF_NOT_FOUND'; end if;

  v_segment_start := v_period_start;
  v_remaining_consumption := v_consumption;

  while v_segment_start < v_period_end loop
    select * into v_tariff
    from public.tariffs t
    where t.project_id = v_reading.project_id
      and t.customer_type = coalesce(v_customer.customer_type,'residential')
      and t.is_active = true
      and t.effective_from <= v_segment_start
      and (t.effective_to is null or t.effective_to >= v_segment_start)
    order by t.effective_from desc, t.version desc, t.id desc
    limit 1;

    if not found then raise exception 'ACTIVE_TARIFF_NOT_FOUND_FOR_DATE'; end if;

    select min(x.effective_from)
      into v_next_tariff_date
    from public.tariffs x
    where x.project_id = v_reading.project_id
      and x.customer_type = coalesce(v_customer.customer_type,'residential')
      and x.is_active = true
      and x.effective_from > v_segment_start
      and x.effective_from <= v_period_end;

    select min(h.effective_from)
      into v_next_household_date
    from private.customer_household_history h
    where h.customer_id = v_customer.id
      and h.effective_from > v_segment_start
      and h.effective_from <= v_period_end;

    v_segment_end := v_period_end - 1;
    if v_next_tariff_date is not null then
      v_segment_end := least(v_segment_end, v_next_tariff_date - 1);
    end if;
    if v_next_household_date is not null then
      v_segment_end := least(v_segment_end, v_next_household_date - 1);
    end if;

    if v_segment_end < v_segment_start then
      v_segment_end := v_segment_start;
    end if;

    v_segment_days := greatest(v_segment_end - v_segment_start + 1, 1);

    -- Consumption is apportioned only when no interval read exists.
    -- The exact cumulative difference remains the source of truth.
    v_segment_consumption := case
      when v_segment_end >= v_period_end - 1 then
        v_remaining_consumption
      else
        v_consumption * v_segment_days::numeric / v_total_days::numeric
    end;

    v_remaining_consumption := greatest(v_remaining_consumption - v_segment_consumption, 0);

    v_household_members := private.mizan_household_members_for_date(v_customer.id, v_segment_start);

    v_allowance_m3 :=
      v_household_members
      * coalesce(v_tariff.base_liters_per_person_per_day,50)
      * v_segment_days / 1000;

    v_included_m3 := least(v_segment_consumption, v_allowance_m3);
    v_tiered_m3 := greatest(v_segment_consumption - v_allowance_m3, 0);

    v_base_fee := v_included_m3 * coalesce(v_tariff.base_price_per_m3,0);
    v_tiered_fee := case
      when v_tiered_m3 > 0
      then private.mizan_calculate_consumption_fee_for_period(v_tariff.id, v_tiered_m3, v_segment_days)
      else 0
    end;

    v_fixed_fee := coalesce(v_tariff.fixed_fee,0)
      * v_segment_days
      / greatest(v_tariff.reference_period_days,1);

    v_current_charge := v_current_charge + v_base_fee + v_tiered_fee + v_fixed_fee;

    v_segments := v_segments || jsonb_build_array(jsonb_build_object(
      'start_date', v_segment_start,
      'end_date', v_segment_end,
      'days', v_segment_days,
      'household_members', v_household_members,
      'tariff_id', v_tariff.id,
      'tariff_version', v_tariff.version,
      'reference_period_days', v_tariff.reference_period_days,
      'allocated_consumption_m3', v_segment_consumption,
      'allowance_m3', v_allowance_m3,
      'included_m3', v_included_m3,
      'tiered_m3', v_tiered_m3,
      'base_fee', v_base_fee,
      'tiered_fee', v_tiered_fee,
      'fixed_fee', v_fixed_fee
    ));

    if v_segment_end >= v_period_end - 1 then
      exit;
    end if;

    v_segment_start := v_segment_end + 1;
  end loop;

  -- For a same-day first read, the loop above has no segment. Charge one actual day.
  if jsonb_array_length(v_segments) = 0 then
    select * into v_tariff
    from public.tariffs t
    where t.project_id = v_reading.project_id
      and t.customer_type = coalesce(v_customer.customer_type,'residential')
      and t.is_active = true
      and t.effective_from <= v_period_end
      and (t.effective_to is null or t.effective_to >= v_period_end)
    order by t.effective_from desc, t.version desc, t.id desc
    limit 1;

    if not found then raise exception 'ACTIVE_TARIFF_NOT_FOUND'; end if;

    v_household_members := private.mizan_household_members_for_date(v_customer.id, v_period_end);
    v_allowance_m3 := v_household_members * coalesce(v_tariff.base_liters_per_person_per_day,50) / 1000;
    v_included_m3 := least(v_consumption,v_allowance_m3);
    v_tiered_m3 := greatest(v_consumption-v_allowance_m3,0);
    v_base_fee := v_included_m3 * coalesce(v_tariff.base_price_per_m3,0);
    v_tiered_fee := case when v_tiered_m3 > 0
      then private.mizan_calculate_consumption_fee_for_period(v_tariff.id,v_tiered_m3,1)
      else 0 end;
    v_fixed_fee := coalesce(v_tariff.fixed_fee,0) / greatest(v_tariff.reference_period_days,1);
    v_current_charge := v_base_fee + v_tiered_fee + v_fixed_fee;
    v_segments := jsonb_build_array(jsonb_build_object(
      'start_date',v_period_end,'end_date',v_period_end,'days',1,
      'household_members',v_household_members,'tariff_id',v_tariff.id,
      'tariff_version',v_tariff.version,'reference_period_days',v_tariff.reference_period_days,
      'allocated_consumption_m3',v_consumption,'allowance_m3',v_allowance_m3,
      'included_m3',v_included_m3,'tiered_m3',v_tiered_m3,
      'base_fee',v_base_fee,'tiered_fee',v_tiered_fee,'fixed_fee',v_fixed_fee
    ));
  end if;

  select coalesce(sum(greatest(coalesce(i.balance,0),0)),0)
    into v_arrears
  from public.invoices i
  where i.customer_id = v_customer.id
    and i.project_id = v_customer.project_id
    and i.status <> 'paid';

  v_grand_total := v_current_charge + v_arrears;

  select coalesce(sum((s->>'allowance_m3')::numeric),0),
         coalesce(sum((s->>'included_m3')::numeric),0),
         coalesce(sum((s->>'tiered_m3')::numeric),0),
         coalesce(sum((s->>'fixed_fee')::numeric),0)
    into v_allowance_m3, v_included_m3, v_tiered_m3, v_fixed_fee
  from jsonb_array_elements(v_segments) s;

  insert into public.invoices(
    project_id,customer_id,meter_id,invoice_number,
    billing_period_start,billing_period_end,
    previous_reading,current_reading,consumption_m3,
    fixed_fee,consumption_fee,total_amount,
    previous_balance,grand_total,amount_paid,balance,status,
    source_reading_id,tariff_id,tariff_version,
    included_consumption_m3,tiered_consumption_m3,
    billing_days,allowance_m3,household_members,fixed_fee_prorated,calculation_snapshot
  )
  values(
    v_reading.project_id,v_customer.id,v_meter.id,null,
    v_period_start,v_period_end,
    coalesce(v_reading.previous_reading,0),v_reading.reading_value,v_consumption,
    v_fixed_fee,v_current_charge-v_fixed_fee,v_current_charge,
    v_arrears,v_grand_total,0,v_grand_total,
    case when v_grand_total=0 then 'paid' else 'unpaid' end,
    v_reading.id,
    nullif((v_segments->-1->>'tariff_id'),'')::uuid,
    nullif((v_segments->-1->>'tariff_version'),'')::integer,
    v_included_m3,v_tiered_m3,
    v_total_days,v_allowance_m3,
    case when jsonb_array_length(v_segments)=1 then (v_segments->0->>'household_members')::integer else null end,
    v_fixed_fee,
    jsonb_build_object(
      'engine_version','fair-variable-period-v1',
      'reading_id',v_reading.id,
      'reading_status',v_reading.status,
      'previous_reading',coalesce(v_reading.previous_reading,0),
      'current_reading',v_reading.reading_value,
      'period_start',v_period_start,
      'period_end',v_period_end,
      'billing_days',v_total_days,
      'actual_consumption_m3',v_consumption,
      'segments',v_segments,
      'arrears',v_arrears,
      'grand_total',v_grand_total,
      'allocation_method','daily_proration_when_interval_read_is_unavailable'
    )
  )
  returning * into v_invoice;

  perform private.mizan_write_audit(
    v_reading.project_id,
    'INVOICE_CREATED_AUTOMATICALLY',
    'invoice',
    v_invoice.id,
    null,
    jsonb_build_object(
      'reading_id',v_reading.id,
      'meter_id',v_meter.id,
      'customer_id',v_customer.id,
      'billing_days',v_total_days,
      'consumption_m3',v_consumption,
      'allowance_m3',v_allowance_m3,
      'grand_total',v_grand_total
    ),
    null,
    'success'
  );

  return v_invoice;
end;
$function$;

revoke all on function private.mizan_issue_invoice_for_reading(uuid,date,date) from public,anon,authenticated;

-- Reading capture is a record, not a human approval. Historical 'approved' rows remain valid.
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
      'reading_value',p_reading_value,
      'reading_method',p_reading_method,
      'reading_date',v_reading_date,
      'status','recorded',
      'ai_confidence',p_ai_confidence,
      'ai_model',p_ai_model,
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

-- Keep the legacy invoice RPC compatible for internal/admin callers, but never make
-- a reading approval the financial approval gate.
create or replace function public.mizan_create_invoice(
  p_project_id uuid,p_customer_id uuid,p_meter_id uuid,p_period_start date,p_period_end date
)
returns public.invoices language plpgsql security definer set search_path=''
as $function$
declare
  v_reading public.meter_readings%rowtype;
  v_invoice public.invoices%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.mizan_can_write_project(p_project_id,'invoices','insert') then raise exception 'INVOICE_WRITE_FORBIDDEN'; end if;

  select * into v_reading
  from public.meter_readings
  where meter_id=p_meter_id
    and project_id=p_project_id
    and customer_id=p_customer_id
    and status not in ('void','exception')
  order by reading_date desc,created_at desc,id desc
  limit 1;

  if not found then raise exception 'METER_READING_REQUIRED'; end if;

  return private.mizan_issue_invoice_for_reading(
    v_reading.id,
    p_period_start,
    p_period_end
  );
end;
$function$;

revoke all on function public.mizan_create_invoice(uuid,uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function public.mizan_create_invoice(uuid,uuid,uuid,date,date) to authenticated;

-- Keep tariff integrity but ensure the reference period is valid.
alter table public.tariffs
  validate constraint tariffs_reference_period_days_positive;

commit;
