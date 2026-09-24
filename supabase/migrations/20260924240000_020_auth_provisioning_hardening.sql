/*
# MIZAN AI — Auth provisioning hardening

Auth users may only receive MIZAN authorization scope from server-controlled
app_metadata. Unprovisioned auth users have no public profile and therefore no
MIZAN access.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_tenant_id uuid;
  v_role text;
  v_project_id uuid;
BEGIN
  v_tenant_id := NULLIF(NEW.raw_app_meta_data->>'tenant_id','')::uuid;
  v_role := COALESCE(NULLIF(NEW.raw_app_meta_data->>'role',''), 'viewer');
  v_project_id := NULLIF(NEW.raw_app_meta_data->>'project_id','')::uuid;

  IF v_tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = v_tenant_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'PROFILE_TENANT_INVALID';
  END IF;

  IF v_role = 'accountant' OR v_role NOT IN (
    'platform_admin','tenant_manager','operations_officer','meter_reader',
    'collection_officer','maintenance_officer','technician',
    'data_exception_officer','viewer'
  ) THEN
    RAISE EXCEPTION 'PROFILE_ROLE_INVALID';
  END IF;

  IF v_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = v_project_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'PROFILE_PROJECT_TENANT_MISMATCH';
  END IF;

  INSERT INTO public.profiles (
    id,email,full_name,role,project_id,tenant_id,must_change_password
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_role,
    v_project_id,
    v_tenant_id,
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, true)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    project_id = EXCLUDED.project_id,
    tenant_id = EXCLUDED.tenant_id,
    must_change_password = EXCLUDED.must_change_password,
    updated_at = now();

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
