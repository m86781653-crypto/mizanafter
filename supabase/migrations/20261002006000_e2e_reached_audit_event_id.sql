-- Root-cause repair for the audit lineage write path.
-- private.mizan_write_audit inserts and returns audit_logs.event_id,
-- but the baseline audit_logs table did not declare the event identifier.
alter table public.audit_logs
  add column if not exists event_id uuid default gen_random_uuid();
