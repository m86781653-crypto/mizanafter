-- Minimize authenticated/anon privileges on critical operational and financial tables.
-- Direct application writes remain server-RPC controlled; SELECT remains policy-controlled where needed.
revoke truncate, trigger, references on public.meter_readings, public.meters, public.invoices, public.payments, public.audit_logs, public.seq_counters, public.project_seq_counters from authenticated, anon;
revoke select on public.seq_counters, public.project_seq_counters from authenticated, anon;
