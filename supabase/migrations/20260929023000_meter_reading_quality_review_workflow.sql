-- MIZAN AI: explicit meter-reading quality review workflow
-- Review is separate from capture and billing. It records a human disposition
-- for readings that the quality engine flags; it never rewrites the source reading.

begin;

alter table public.meter_readings
  add column if not exists quality_review_status text not null default 'not_required',
  add column if not exists quality_reviewed_by uuid references auth.users(id),
  add column if not exists quality_reviewed_at timestamptz,
  add column if not exists quality_review_note text;

alter table public.meter_readings
  drop constraint if exists meter_readings_quality_review_status_check;

alter table public.meter_readings
  add constraint meter_readings_quality_review_status_check
  check (quality_review_status in ('not_required','pending','confirmed','rejected','waived'));

create index if not exists idx_meter_readings_quality_review
  on public.meter_readings(project_id, quality_review_status, reading_date desc);

create or replace function private.mizan_sync_meter_reading_quality_review_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if tg_op = 'INSERT' then
    new.quality_review_status := case when new.anomaly_flag then 'pending' else 'not_required' end;
    new.quality_reviewed_by := null;
    new.quality_reviewed_at := null;
    new.quality_review_note := null;
    return new;
  end if;

  if new.anomaly_flag then
    new.quality_review_status := 'pending';
    new.quality_reviewed_by := null;
    new.quality_reviewed_at := null;
    new.quality_review_note := null;
  elsif not new.anomaly_flag then
    new.quality_review_status := 'not_required';
    new.quality_reviewed_by := null;
    new.quality_reviewed_at := null;
    new.quality_review_note := null;
  end if;
  return new;
end;
$function$;

revoke all on function private.mizan_sync_meter_reading_quality_review_status() from public, anon, authenticated;

drop trigger if exists trg_meter_reading_quality_review_status on public.meter_readings;
create trigger trg_meter_reading_quality_review_status
before insert or update of anomaly_flag, reading_value, previous_reading, consumption,
  reading_method, ai_extracted_value, ai_confidence, status
on public.meter_readings
for each row execute function private.mizan_sync_meter_reading_quality_review_status();

create or replace function public.mrx_review_meter_reading(
  p_reading_id uuid,
  p_decision text,
  p_note text default null
)
returns public.meter_readings
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_reading public.meter_readings%rowtype;
  v_status text;
  v_uid uuid := (select auth.uid());
  v_previous_review_status text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  v_status := lower(trim(coalesce(p_decision,'')));
  if v_status not in ('confirmed','rejected','waived') then
    raise exception 'INVALID_QUALITY_REVIEW_DECISION';
  end if;

  select * into v_reading
  from public.meter_readings
  where id = p_reading_id
  for update;

  if not found then raise exception 'READING_NOT_FOUND'; end if;

  if not private.mizan_can_write_project(v_reading.project_id, 'meter_readings', 'update') then
    raise exception 'METER_REVIEW_FORBIDDEN';
  end if;

  if not v_reading.anomaly_flag then
    raise exception 'READING_REVIEW_NOT_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_note,'')),'') is null then
    raise exception 'QUALITY_REVIEW_NOTE_REQUIRED';
  end if;

  v_previous_review_status := v_reading.quality_review_status;

  update public.meter_readings
  set quality_review_status = v_status,
      quality_reviewed_by = v_uid,
      quality_reviewed_at = now(),
      quality_review_note = trim(p_note)
  where id = v_reading.id
  returning * into v_reading;

  insert into public.audit_logs(
    table_name, record_id, action, user_id, actor_user_id, project_id,
    entity_type, entity_id, reason, result, before_data, after_data
  )
  values(
    'meter_readings', v_reading.id, 'MRX_QUALITY_REVIEW', v_uid, v_uid, v_reading.project_id,
    'meter_reading', v_reading.id, trim(p_note), v_status,
    jsonb_build_object(
      'quality_review_status', v_previous_review_status,
      'anomaly_flag', v_reading.anomaly_flag,
      'anomaly_reason', v_reading.anomaly_reason
    ),
    jsonb_build_object(
      'quality_review_status', v_status,
      'quality_reviewed_by', v_uid,
      'quality_reviewed_at', v_reading.quality_reviewed_at,
      'quality_review_note', v_reading.quality_review_note
    )
  );

  return v_reading;
end;
$function$;

revoke execute on function public.mrx_review_meter_reading(uuid,text,text) from public, anon;
grant execute on function public.mrx_review_meter_reading(uuid,text,text) to authenticated;

commit;
