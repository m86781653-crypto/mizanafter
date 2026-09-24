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
AS $function$
DECLARE
  new_event_id uuid;
  actor uuid := (SELECT auth.uid());
  actor_name text;
BEGIN
  SELECT full_name INTO actor_name FROM public.profiles WHERE id = actor;
  INSERT INTO public.audit_logs (
    event_id, table_name, record_id, action, old_values, new_values,
    user_id, user_name, actor_user_id, project_id, entity_type, entity_id,
    before_data, after_data, reason, result
  )
  VALUES (
    gen_random_uuid(), p_entity_type, p_entity_id, p_action,
    p_before_data, p_after_data, actor, actor_name, actor, p_project_id,
    p_entity_type, p_entity_id, p_before_data, p_after_data, p_reason, p_result
  )
  RETURNING event_id INTO new_event_id;
  RETURN new_event_id;
END;
$function$;
