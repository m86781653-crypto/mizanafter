/*
# MIZAN — append-only audit controls
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
DECLARE new_event_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    event_id, actor_user_id, project_id, action, entity_type, entity_id,
    before_data, after_data, reason, result
  )
  VALUES (
    gen_random_uuid(), (SELECT auth.uid()), p_project_id, p_action,
    p_entity_type, p_entity_id, p_before_data, p_after_data, p_reason, p_result
  )
  RETURNING event_id INTO new_event_id;
  RETURN new_event_id;
END;
$$;

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
FOR EACH ROW EXECUTE FUNCTION private.mizan_block_audit_mutation();

REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM authenticated, anon;


CREATE OR REPLACE FUNCTION private.mizan_audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id uuid;
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_project_id := NULLIF(to_jsonb(OLD)->>'project_id','')::uuid;
    v_entity_id := NULLIF(to_jsonb(OLD)->>'id','')::uuid;
    v_before := to_jsonb(OLD);
  ELSE
    v_project_id := NULLIF(to_jsonb(NEW)->>'project_id','')::uuid;
    v_entity_id := NULLIF(to_jsonb(NEW)->>'id','')::uuid;
    v_after := to_jsonb(NEW);
    IF TG_OP = 'UPDATE' THEN v_before := to_jsonb(OLD); END IF;
  END IF;

  PERFORM private.mizan_write_audit(
    v_project_id, 'row_' || lower(TG_OP), TG_TABLE_NAME,
    v_entity_id, v_before, v_after, NULL, 'success'
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION private.mizan_audit_row_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_meter_readings ON public.meter_readings;
CREATE TRIGGER trg_audit_meter_readings AFTER INSERT OR UPDATE OR DELETE ON public.meter_readings FOR EACH ROW EXECUTE FUNCTION private.mizan_audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION private.mizan_audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION private.mizan_audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_customers ON public.customers;
CREATE TRIGGER trg_audit_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION private.mizan_audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_meters ON public.meters;
CREATE TRIGGER trg_audit_meters AFTER INSERT OR UPDATE OR DELETE ON public.meters FOR EACH ROW EXECUTE FUNCTION private.mizan_audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_faults ON public.faults;
CREATE TRIGGER trg_audit_faults AFTER INSERT OR UPDATE OR DELETE ON public.faults FOR EACH ROW EXECUTE FUNCTION private.mizan_audit_row_change();

DROP TRIGGER IF EXISTS trg_audit_maintenance_work_orders ON public.maintenance_work_orders;
CREATE TRIGGER trg_audit_maintenance_work_orders AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_work_orders FOR EACH ROW EXECUTE FUNCTION private.mizan_audit_row_change();

REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM authenticated, anon;
