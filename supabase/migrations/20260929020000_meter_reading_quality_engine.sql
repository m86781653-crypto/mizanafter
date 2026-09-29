-- MIZAN AI: production meter-reading quality engine
-- Adds server-authoritative quality evidence and conservative anomaly detection.
-- Deterministic integrity checks remain hard guards; statistical findings are review signals.

begin;

alter table public.meter_readings
  add column if not exists reading_quality jsonb not null default '{}'::jsonb;

create index if not exists idx_meter_readings_anomaly
  on public.meter_readings(project_id, meter_id, anomaly_flag, reading_date desc);

create or replace function private.mizan_assess_meter_reading_quality()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_history_count integer := 0;
  v_q1 numeric;
  v_q3 numeric;
  v_iqr numeric;
  v_upper_fence numeric;
  v_lower_fence numeric;
  v_flatline_count integer := 0;
  v_reasons text[] := array[]::text[];
  v_anomaly boolean := false;
begin
  if new.reading_method = 'photo' then
    if new.ai_extracted_value is null
       or abs(new.reading_value - new.ai_extracted_value) > 0.01
    then
      v_reasons := array_append(v_reasons, 'OCR_READING_MISMATCH');
    end if;

    if new.ai_confidence is null or new.ai_confidence < 70 then
      v_reasons := array_append(v_reasons, 'OCR_CONFIDENCE_LOW');
    end if;
  end if;

  if coalesce(new.consumption, 0) < 0 then
    v_reasons := array_append(v_reasons, 'NEGATIVE_CONSUMPTION');
  end if;

  select
    count(*),
    percentile_cont(0.25) within group (order by x.consumption)::numeric,
    percentile_cont(0.75) within group (order by x.consumption)::numeric
  into v_history_count, v_q1, v_q3
  from (
    select mr.consumption
    from public.meter_readings mr
    where mr.meter_id = new.meter_id
      and mr.project_id = new.project_id
      and (tg_op = 'INSERT' or mr.id <> new.id)
      and mr.status not in ('void','exception')
      and mr.consumption is not null
      and mr.consumption >= 0
    order by mr.reading_date desc, mr.created_at desc, mr.id desc
    limit 24
  ) x;

  if v_history_count >= 5 and v_q1 is not null and v_q3 is not null then
    v_iqr := greatest(v_q3 - v_q1, 0);
    v_upper_fence := v_q3 + (1.5 * v_iqr);
    v_lower_fence := greatest(v_q1 - (1.5 * v_iqr), 0);

    if new.consumption > v_upper_fence then
      v_reasons := array_append(v_reasons, 'CONSUMPTION_HIGH_OUTLIER');
    elsif new.consumption < v_lower_fence then
      v_reasons := array_append(v_reasons, 'CONSUMPTION_LOW_OUTLIER');
    end if;
  end if;

  select count(*)
    into v_flatline_count
  from (
    select mr.consumption
    from public.meter_readings mr
    where mr.meter_id = new.meter_id
      and mr.project_id = new.project_id
      and mr.status not in ('void','exception')
      and mr.reading_date < new.reading_date
    order by mr.reading_date desc, mr.created_at desc, mr.id desc
    limit 3
  ) x
  where coalesce(x.consumption, 0) = 0;

  if coalesce(new.consumption, 0) = 0 and v_flatline_count = 3 then
    v_reasons := array_append(v_reasons, 'CONSUMPTION_FLATLINE');
  end if;

  v_anomaly := cardinality(v_reasons) > 0;

  new.anomaly_flag := v_anomaly;
  new.anomaly_reason := case
    when v_anomaly then array_to_string(v_reasons, ',')
    else null
  end;

  new.reading_quality := jsonb_build_object(
    'engine_version', 'meter-reading-quality-v1',
    'evaluated_at', now(),
    'reading_method', new.reading_method,
    'ocr_confidence', new.ai_confidence,
    'ocr_value_matches_reading', case
      when new.ai_extracted_value is null then null
      else abs(new.reading_value - new.ai_extracted_value) <= 0.01
    end,
    'previous_reading', new.previous_reading,
    'current_reading', new.reading_value,
    'consumption_m3', new.consumption,
    'history_count', v_history_count,
    'q1_consumption_m3', v_q1,
    'q3_consumption_m3', v_q3,
    'iqr_consumption_m3', v_iqr,
    'upper_fence_m3', v_upper_fence,
    'lower_fence_m3', v_lower_fence,
    'flatline_previous_zero_count', v_flatline_count,
    'anomaly', v_anomaly,
    'anomaly_reasons', to_jsonb(v_reasons)
  );

  return new;
end;
$function$;

revoke all on function private.mizan_assess_meter_reading_quality() from public, anon, authenticated;

drop trigger if exists trg_meter_reading_quality on public.meter_readings;
create trigger trg_meter_reading_quality
before insert or update of reading_value, previous_reading, consumption, reading_method,
  ai_extracted_value, ai_confidence, status
on public.meter_readings
for each row execute function private.mizan_assess_meter_reading_quality();

commit;
