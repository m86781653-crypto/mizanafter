-- Repair the audit-log FK index for environments that already passed the
-- historical production index migration before its column mismatch was corrected.
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
