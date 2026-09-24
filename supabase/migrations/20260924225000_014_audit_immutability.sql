/*
# MIZAN — append-only audit controls

Extends the existing audit log with a server-owned append-only writer.
Client roles cannot update/delete or fabricate privileged audit history.
*/

CREATE OR REPLACE FUNCTION private.mizan_write_audit(
  p_project_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_before_data jsonb DEFAULT NULL,
  p_after_data jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_result text DEFAULT 'success'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_event_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    event_id, actor_user_id, project_id, action, entity_type, entity_id,
    before_data, after_data, reason, result
  )
  VALUES (
    gen_random_uuid(), (SELECT auth.uid()), p_project_id, p_action,
    p_entity_type, p_entity_id, p_before_data, p_after_data,
    p_reason, p_result
  )
  RETURNING event_id INTO new_event_id;

  RETURN new_event_id;
END;
$$;

-- This is an internal primitive for SECURITY DEFINER code and triggers only.
-- It must never be callable by a client role.
REVOKE ALL ON FUNCTION private.mizan_write_audit(uuid,text,text,uuid,jsonb,jsonb,text,text)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.mizan_block_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'AUDIT_LOG_IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW
EXECUTE FUNCTION private.mizan_block_audit_mutation();

REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM authenticated, anon;

COMMENT ON FUNCTION private.mizan_write_audit IS
  'Internal server-owned append-only audit writer; inaccessible to client roles.';
COMMENT ON FUNCTION private.mizan_block_audit_mutation IS
  'Prevents update/delete of governance audit history.';
