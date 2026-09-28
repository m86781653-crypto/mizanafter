-- Repair production databases that may already have the historical FK-index migration
-- recorded without the audit lineage columns it expected.
alter table public.audit_logs
  add column if not exists actor_user_id uuid,
  add column if not exists project_id uuid,
  add column if not exists entity_type text,
  add column if not exists entity_id uuid,
  add column if not exists result text,
  add column if not exists before_data jsonb,
  add column if not exists after_data jsonb;

alter table public.ai_logs
  add column if not exists project_id uuid;
