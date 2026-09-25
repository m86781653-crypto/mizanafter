create or replace function private.mizan_touch_updated_at() returns trigger
language plpgsql security invoker set search_path=''
as $$ begin new.updated_at=now(); return new; end; $$;

drop trigger if exists trg_service_interruptions_updated_at on public.service_interruptions;
create trigger trg_service_interruptions_updated_at before update on public.service_interruptions
for each row execute function private.mizan_touch_updated_at();

drop trigger if exists trg_audit_service_interruptions on public.service_interruptions;
create trigger trg_audit_service_interruptions after insert or update or delete on public.service_interruptions
for each row execute function private.mizan_audit_row_change();
