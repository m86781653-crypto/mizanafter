-- MIZAN hierarchical tenancy governance
-- Main tenant: oversight/read across direct sub-tenants.
-- Sub-tenant: operational write only inside its own tenant.

CREATE OR REPLACE FUNCTION private.mizan_can_access_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=''
AS $function$
  SELECT COALESCE(
    private.mizan_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = target_project_id
        AND p.tenant_id = private.mizan_user_tenant_id()
        AND p.tenant_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.tenants t ON t.id = p.tenant_id
      JOIN public.tenants parent ON parent.id = t.parent_tenant_id
      WHERE p.id = target_project_id
        AND t.tenant_type = 'sub_tenant'
        AND t.status = 'active'
        AND parent.tenant_type = 'main_tenant'
        AND parent.status = 'active'
        AND parent.id = private.mizan_user_tenant_id()
    ),
    false
  )
$function$;

CREATE OR REPLACE FUNCTION private.mizan_can_write_project(
  target_project_id uuid,
  table_name text,
  operation text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  role_code text;
  project_tenant_id uuid;
  user_tenant_id uuid;
BEGIN
  SELECT p.tenant_id INTO project_tenant_id
  FROM public.projects p
  WHERE p.id = target_project_id;

  user_tenant_id := private.mizan_user_tenant_id();

  IF project_tenant_id IS NULL OR user_tenant_id IS NULL THEN
    RETURN false;
  END IF;

  IF private.mizan_is_platform_admin() THEN
    RETURN true;
  END IF;

  IF project_tenant_id <> user_tenant_id THEN
    RETURN false;
  END IF;

  IF NOT private.mizan_can_access_project(target_project_id) THEN
    RETURN false;
  END IF;

  role_code := private.mizan_user_role();

  IF operation = 'delete' THEN
    RETURN role_code = 'tenant_manager';
  END IF;

  IF table_name IN ('meter_readings', 'field_tasks') THEN
    RETURN role_code IN ('tenant_manager','operations_officer','meter_reader','data_exception_officer')
      AND (operation = 'insert' OR role_code IN ('tenant_manager','operations_officer','data_exception_officer'));
  END IF;

  IF table_name = 'payments' THEN
    RETURN role_code IN ('tenant_manager','collection_officer');
  END IF;

  IF table_name IN ('invoices','tariffs','tariff_tiers') THEN
    RETURN role_code IN ('tenant_manager','operations_officer','data_exception_officer');
  END IF;

  IF table_name IN ('faults','maintenance_work_orders') THEN
    RETURN role_code IN ('tenant_manager','operations_officer','maintenance_officer','technician')
      AND (role_code <> 'technician' OR operation = 'update');
  END IF;

  IF table_name IN ('assets','wells','pumps','tanks') THEN
    RETURN role_code IN ('tenant_manager','operations_officer','maintenance_officer');
  END IF;

  IF table_name IN ('customers','meters') THEN
    RETURN role_code IN ('tenant_manager','operations_officer','data_exception_officer');
  END IF;

  IF table_name IN ('notifications','kpi_snapshots') THEN
    RETURN role_code IN ('tenant_manager','operations_officer');
  END IF;

  IF table_name IN ('audit_logs','ai_logs') THEN
    RETURN false;
  END IF;

  RETURN role_code IN ('tenant_manager','operations_officer');
END;
$function$;

CREATE OR REPLACE FUNCTION public.mizan_create_subtenant(
  p_name_ar text,
  p_name_en text DEFAULT NULL,
  p_timezone text DEFAULT 'Asia/Aden'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  caller_tenant_id uuid;
  new_tenant_id uuid;
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  caller_tenant_id := private.mizan_user_tenant_id();
  caller_role := private.mizan_user_role();

  IF caller_tenant_id IS NULL OR caller_role <> 'tenant_manager' THEN
    RAISE EXCEPTION 'TENANT_CREATE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = caller_tenant_id
      AND t.tenant_type = 'main_tenant'
      AND t.status = 'active'
  ) THEN
    RAISE EXCEPTION 'MAIN_TENANT_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF nullif(trim(p_name_ar), '') IS NULL THEN
    RAISE EXCEPTION 'TENANT_NAME_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.parent_tenant_id = caller_tenant_id
      AND lower(trim(t.name_ar)) = lower(trim(p_name_ar))
      AND t.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'TENANT_NAME_EXISTS' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.tenants (
    parent_tenant_id, name_ar, name_en, tenant_type, timezone, status
  )
  VALUES (
    caller_tenant_id, trim(p_name_ar), nullif(trim(p_name_en), ''),
    'sub_tenant', coalesce(nullif(trim(p_timezone), ''), 'Asia/Aden'), 'active'
  )
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.audit_logs (
    table_name, record_id, action, user_id, actor_user_id,
    entity_type, entity_id, new_values, result, reason
  )
  VALUES (
    'tenants', new_tenant_id, 'CREATE', auth.uid(), auth.uid(),
    'tenant', new_tenant_id,
    jsonb_build_object(
      'parent_tenant_id', caller_tenant_id,
      'name_ar', trim(p_name_ar),
      'tenant_type', 'sub_tenant',
      'status', 'active'
    ),
    'accepted', 'main_tenant_manager_created_subtenant'
  );

  RETURN new_tenant_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.mizan_create_subtenant(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mizan_create_subtenant(text,text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mizan_create_subtenant(text,text,text) TO authenticated;

COMMENT ON FUNCTION public.mizan_create_subtenant(text,text,text)
IS 'Creates a direct child sub-tenant only for an active main-tenant manager; audited and isolated from sibling tenants.';

CREATE INDEX IF NOT EXISTS idx_tenants_parent_status
  ON public.tenants(parent_tenant_id, status)
  WHERE parent_tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_tenant_status
  ON public.projects(tenant_id, status);
