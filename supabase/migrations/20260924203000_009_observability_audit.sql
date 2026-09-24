/*
# MIZAN — observability and audit hardening
No replacement logging system. Extends existing audit_logs/ai_logs.
*/

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS event_id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS before_data jsonb,
  ADD COLUMN IF NOT EXISTS after_data jsonb,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS result text,
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_audit_logs_event_id
  ON public.audit_logs(event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

COMMENT ON TABLE public.audit_logs IS
  'MIZAN immutable governance history: who, what, when, where, before, after, why, result.';
