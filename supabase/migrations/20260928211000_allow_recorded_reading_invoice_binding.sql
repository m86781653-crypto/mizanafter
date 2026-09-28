-- Compatibility fix: invoices may be sourced from recorded readings.
-- Historical approved readings remain valid; new readings are recorded, not financially approved.

create or replace function private.mizan_bind_invoice_source_reading()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.meter_readings;
begin
  select * into r
  from public.meter_readings
  where id = (
    select mr.id
    from public.meter_readings mr
    where mr.project_id = new.project_id
      and mr.meter_id = new.meter_id
      and mr.customer_id = new.customer_id
      and mr.status not in ('void','exception')
      and mr.reading_value = new.current_reading
    order by mr.reading_date desc, mr.created_at desc, mr.id desc
    limit 1
  )
  for share;

  if not found then
    raise exception 'METER_READING_SOURCE_REQUIRED';
  end if;

  new.source_reading_id := r.id;
  new.previous_reading := r.previous_reading;
  new.consumption_m3 := coalesce(r.consumption, r.reading_value - r.previous_reading);
  return new;
end;
$$;

revoke all on function private.mizan_bind_invoice_source_reading()
from public, anon, authenticated;
