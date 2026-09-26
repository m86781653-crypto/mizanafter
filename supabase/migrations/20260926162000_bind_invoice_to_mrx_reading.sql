-- Follow-up root fix: bind invoices to the exact approved MRX reading
-- and advance the meter baseline atomically after successful issuance.

create or replace function private.mizan_bind_invoice_source_reading()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare r public.meter_readings;
begin
  select * into r from public.meter_readings
  where id = (
    select mr.id from public.meter_readings mr
    where mr.project_id = new.project_id and mr.meter_id = new.meter_id
      and mr.customer_id = new.customer_id and mr.status = 'approved'
      and mr.reading_value = new.current_reading
    order by mr.reading_date desc, mr.created_at desc, mr.id desc limit 1
  ) for share;
  if not found then raise exception 'APPROVED_MRX_READING_SOURCE_REQUIRED'; end if;
  new.source_reading_id := r.id;
  new.previous_reading := r.previous_reading;
  new.consumption_m3 := coalesce(r.consumption, r.reading_value - r.previous_reading);
  return new;
end;
$$;

create or replace function private.mizan_sync_meter_after_invoice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.meters set last_reading=new.current_reading,
    last_reading_date=coalesce((select reading_date from public.meter_readings where id=new.source_reading_id),last_reading_date)
  where id=new.meter_id and project_id=new.project_id;
  return new;
end;
$$;

drop trigger if exists mizan_bind_invoice_source_reading on public.invoices;
create trigger mizan_bind_invoice_source_reading before insert on public.invoices
for each row execute function private.mizan_bind_invoice_source_reading();

drop trigger if exists mizan_sync_meter_after_invoice on public.invoices;
create trigger mizan_sync_meter_after_invoice after insert on public.invoices
for each row execute function private.mizan_sync_meter_after_invoice();

create unique index if not exists invoices_source_reading_uidx
on public.invoices(source_reading_id) where source_reading_id is not null;

revoke all on function private.mizan_bind_invoice_source_reading() from public,anon,authenticated;
revoke all on function private.mizan_sync_meter_after_invoice() from public,anon,authenticated;