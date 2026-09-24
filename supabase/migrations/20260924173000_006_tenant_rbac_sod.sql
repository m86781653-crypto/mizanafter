/*
# MIZAN AI — Production Foundation 006
## Tenant-scoped RBAC + separation of duties + database authorization

This migration completes the first security workstream without replacing any
existing water-service tables.

Design:
- Existing project-centric model remains the compatibility key.
- tenant_id becomes the authoritative governance boundary.
- Existing projects are deterministically mapped to sub-tenants.
- Existing legacy role values remain readable during application cutover.
- The Accountant role is not granted any production permission and cannot be
  assigned to a profile (enforced by 005).
- RLS becomes tenant-aware and operation-aware.
- Permissions are explicit and auditable.
- Normal users cannot fabricate privileged audit records.
*/

-- ---------------------------------------------------------------------------
-- 1. Tenant backfill: one platform tenant, one sub-tenant per existing project
-- ---------------------------------------------------------------------------

INSERT INTO public.tenants (name_ar, name_en, tenant_type, parent_tenant_id, timezone, status)
SELECT 'منصة ميزان الرئيسية', 'MIZAN Main Tenant', 'main_tenant', NULL, 'Asia/Aden', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenants
  WHERE tenant_type = 'main_tenant' AND status <> 'archived'
);

DO $$
DECLARE
  main_tenant uuid;
BEGIN
  SELECT id INTO main_tenant
  FROM public.tenants
  WHERE tenant_type = 'main_tenant' AND status <> 'archived'
  ORDER BY created_at
  LIMIT 1;

  IF main_tenant IS NULL THEN
    RAISE EXCEPTION 'TENANT_BOOTSTRAP_FAILED';
  END IF;

  INSERT INTO public.tenants (
    parent_tenant_id, name_ar, name_en, tenant_type, timezone, status
  )
  SELECT
    main_tenant,
    p.name_ar,
    p.name_en,
    'sub_tenant',
    'Asia/Aden',
    CASE WHEN p.status = 'active' THEN 'active' ELSE 'suspended' END
  FROM public.projects p
  WHERE p.tenant_id IS NULL;

  UPDATE public.projects p
  SET tenant_id = t.id,
      updated_at = now()
  FROM public.tenants t
  WHERE p.tenant_id IS NULL
    AND t.parent_tenant_id = main_tenant
    AND t.tenant_type = 'sub_tenant'
    AND t.name_ar = p.name_ar
    AND COALESCE(t.name_en, '') = COALESCE(p.name_en, '');
END $$;

-- If duplicate project names exist, assign any still-unassigned project to a
-- deterministic newly created sub-tenant rather than leaving a security hole.
DO $$
DECLARE
  main_tenant uuid;
  p record;
  new_tenant uuid;
BEGIN
  SELECT id INTO main_tenant
  FROM public.tenants
  WHERE tenant_type = 'main_tenant' AND status <> 'archived'
  ORDER BY created_at
  LIMIT 1;

  FOR p IN SELECT id, name_ar, name_en, status FROM public.projects WHERE tenant_id IS NULL LOOP
    INSERT INTO public.tenants (
      parent_tenant_id, name_ar, name_en, tenant_type, timezone, status
    )
    VALUES (
      main_tenant,
      p.name_ar || ' — ' || left(p.id::text, 8),
      p.name_en,
      'sub_tenant',
      'Asia/Aden',
      CASE WHEN p.status = 'active' THEN 'active' ELSE 'suspended' END
    )
    RETURNING id INTO new_tenant;

    UPDATE public.projects
    SET tenant_id = new_tenant, updated_at = now()
    WHERE id = p.id;
  END LOOP;
END $$;

-- Backfill user tenant from their project. Platform administrators belong to
-- the main tenant; project-scoped users belong to their project's sub-tenant.
DO $$
DECLARE
  main_tenant uuid;
BEGIN
  SELECT id INTO main_tenant
  FROM public.tenants
  WHERE tenant_type = 'main_tenant' AND status <> 'archived'
  ORDER BY created_at
  LIMIT 1;

  UPDATE public.profiles pr
  SET tenant_id = p.tenant_id,
      updated_at = now()
  FROM public.projects p
  WHERE pr.project_id = p.id
    AND pr.tenant_id IS NULL;

  UPDATE public.profiles
  SET tenant_id = main_tenant,
      updated_at = now()
  WHERE tenant_id IS NULL
    AND role IN ('super_admin', 'platform_admin');
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_project_tenant
  ON public.profiles(project_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_projects_tenant_status
  ON public.projects(tenant_id, status);

-- A project and its tenant must remain aligned after this cutover.
CREATE OR REPLACE FUNCTION public.enforce_project_tenant_alignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_TENANT_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = NEW.tenant_id
      AND t.tenant_type = 'sub_tenant'
      AND t.status <> 'archived'
  ) THEN
    RAISE EXCEPTION 'INVALID_PROJECT_TENANT';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_tenant_alignment ON public.projects;
CREATE TRIGGER trg_project_tenant_alignment
BEFORE INSERT OR UPDATE OF tenant_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.enforce_project_tenant_alignment();

-- ---------------------------------------------------------------------------
-- 2. Explicit permission catalogue
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.mizan_permissions (
  permission_code text PRIMARY KEY,
  name_ar text NOT NULL,
  description_ar text NOT NULL
);

INSERT INTO public.mizan_permissions (permission_code, name_ar, description_ar)
VALUES
  ('project.read', 'قراءة نطاق المشروع', 'قراءة بيانات المشروع ضمن النطاق المسموح'),
  ('project.manage', 'إدارة المشروع', 'إدارة إعدادات المشروع وبياناته التشغيلية'),
  ('meter.capture', 'التقاط قراءة العداد', 'إنشاء قراءة ميدانية مرتبطة بمهمة/عداد'),
  ('meter.exception', 'معالجة استثناء قراءة', 'التحقيق والتصحيح المقيد لقراءات العدادات'),
  ('customer.manage', 'إدارة المشتركين', 'إدارة بيانات المشتركين وربط العدادات'),
  ('billing.manage', 'إدارة الفوترة', 'إدارة عمليات الفوترة ضمن نطاق الخدمة'),
  ('collection.record', 'تسجيل التحصيل', 'تسجيل عمليات التحصيل وإيصالاتها'),
  ('maintenance.manage', 'إدارة الصيانة', 'إدارة الأعطال وأوامر العمل'),
  ('maintenance.execute', 'تنفيذ الصيانة', 'تنفيذ أوامر العمل المسندة'),
  ('data.exception', 'إدارة استثناءات البيانات', 'التحقيق والتصحيحات المقيدة مع التدقيق'),
  ('audit.read', 'قراءة التدقيق', 'قراءة سجل التدقيق المسموح به'),
  ('audit.write_system', 'تسجيل تدقيق نظامي', 'إدخالات التدقيق التي ينشئها النظام فقط')
ON CONFLICT (permission_code) DO UPDATE
SET name_ar = EXCLUDED.name_ar,
    description_ar = EXCLUDED.description_ar;

CREATE TABLE IF NOT EXISTS public.mizan_role_permissions (
  role_code text NOT NULL REFERENCES public.mizan_role_catalog(role_code) ON DELETE CASCADE,
  permission_code text NOT NULL REFERENCES public.mizan_permissions(permission_code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

INSERT INTO public.mizan_role_permissions (role_code, permission_code)
SELECT r.role_code, p.permission_code
FROM (
  VALUES
    ('platform_admin','project.read'),('platform_admin','project.manage'),
    ('platform_admin','meter.capture'),('platform_admin','meter.exception'),
    ('platform_admin','customer.manage'),('platform_admin','billing.manage'),
    ('platform_admin','collection.record'),('platform_admin','maintenance.manage'),
    ('platform_admin','maintenance.execute'),('platform_admin','data.exception'),
    ('platform_admin','audit.read'),('platform_admin','audit.write_system'),

    ('super_admin','project.read'),('super_admin','project.manage'),
    ('super_admin','meter.capture'),('super_admin','meter.exception'),
    ('super_admin','customer.manage'),('super_admin','billing.manage'),
    ('super_admin','collection.record'),('super_admin','maintenance.manage'),
    ('super_admin','maintenance.execute'),('super_admin','data.exception'),
    ('super_admin','audit.read'),('super_admin','audit.write_system'),

    ('tenant_manager','project.read'),('tenant_manager','project.manage'),
    ('tenant_manager','meter.capture'),('tenant_manager','meter.exception'),
    ('tenant_manager','customer.manage'),('tenant_manager','billing.manage'),
    ('tenant_manager','collection.record'),('tenant_manager','maintenance.manage'),
    ('tenant_manager','maintenance.execute'),('tenant_manager','data.exception'),
    ('tenant_manager','audit.read'),('tenant_manager','audit.write_system'),

    ('project_manager','project.read'),('project_manager','project.manage'),
    ('project_manager','meter.capture'),('project_manager','meter.exception'),
    ('project_manager','customer.manage'),('project_manager','billing.manage'),
    ('project_manager','collection.record'),('project_manager','maintenance.manage'),
    ('project_manager','maintenance.execute'),('project_manager','data.exception'),
    ('project_manager','audit.read'),('project_manager','audit.write_system'),

    ('operations_officer','project.read'),('operations_officer','project.manage'),
    ('operations_officer','meter.capture'),('operations_officer','meter.exception'),
    ('operations_officer','customer.manage'),('operations_officer','billing.manage'),
    ('operations_officer','maintenance.manage'),('operations_officer','maintenance.execute'),

    ('meter_reader','project.read'),('meter_reader','meter.capture'),

    ('collection_officer','project.read'),('collection_officer','collection.record'),

    ('collector','project.read'),('collector','collection.record'),

    ('maintenance_officer','project.read'),('maintenance_officer','maintenance.manage'),

    ('technician','project.read'),('technician','maintenance.execute'),

    ('maintenance_tech','project.read'),('maintenance_tech','maintenance.execute'),

    ('data_exception_officer','project.read'),('data_exception_officer','meter.exception'),
    ('data_exception_officer','data.exception'),

    ('viewer','project.read'),
    ('read_only','project.read')
) AS x(role_code, permission_code)
JOIN public.mizan_role_catalog r ON r.role_code = x.role_code
JOIN public.mizan_permissions p ON p.permission_code = x.permission_code
ON CONFLICT DO NOTHING;

ALTER TABLE public.mizan_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mizan_role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mizan_permissions_read ON public.mizan_permissions;
CREATE POLICY mizan_permissions_read ON public.mizan_permissions
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mizan_role_permissions_read ON public.mizan_role_permissions;
CREATE POLICY mizan_role_permissions_read ON public.mizan_role_permissions
FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3. Central authorization helpers
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.mizan_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p.role = 'super_admin' THEN 'platform_admin'
    WHEN p.role = 'project_manager' THEN 'tenant_manager'
    WHEN p.role = 'collector' THEN 'collection_officer'
    WHEN p.role = 'maintenance_tech' THEN 'technician'
    WHEN p.role = 'read_only' THEN 'viewer'
    ELSE p.role
  END
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.mizan_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = (SELECT auth.uid())
$$;

CREATE OR REPLACE FUNCTION private.mizan_is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT private.mizan_user_role() IN ('platform_admin')), false)
$$;

CREATE OR REPLACE FUNCTION private.mizan_can_access_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    private.mizan_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.projects p
      JOIN public.profiles pr ON pr.tenant_id = p.tenant_id
      WHERE p.id = target_project_id
        AND pr.id = (SELECT auth.uid())
        AND p.tenant_id = private.mizan_user_tenant_id()
        AND p.tenant_id IS NOT NULL
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION private.mizan_has_permission(permission_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public.mizan_role_permissions rp
    WHERE rp.role_code = private.mizan_user_role()
      AND rp.permission_code = permission_code
  ), false)
$$;

CREATE OR REPLACE FUNCTION private.mizan_can_write_project(target_project_id uuid, table_name text, operation text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  role_code text;
BEGIN
  IF NOT private.mizan_can_access_project(target_project_id) THEN
    RETURN false;
  END IF;

  role_code := private.mizan_user_role();

  IF role_code = 'platform_admin' THEN
    RETURN true;
  END IF;

  IF operation = 'delete' THEN
    RETURN role_code = 'tenant_manager';
  END IF;

  IF table_name IN ('meter_readings', 'field_tasks') THEN
    RETURN role_code IN ('tenant_manager','operations_officer','meter_reader','data_exception_officer')
      AND (
        operation = 'insert'
        OR role_code IN ('tenant_manager','operations_officer','data_exception_officer')
      );
  END IF;

  IF table_name IN ('payments') THEN
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
$$;

-- ---------------------------------------------------------------------------
-- 4. Profiles: user can update safe personal fields only; role/scope is governed
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS select_own_profile ON public.profiles;
DROP POLICY IF EXISTS update_own_profile ON public.profiles;
DROP POLICY IF EXISTS insert_profile_admin ON public.profiles;
DROP POLICY IF EXISTS delete_profile_admin ON public.profiles;

CREATE POLICY select_own_profile ON public.profiles
FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR private.mizan_is_platform_admin()
  OR (
    private.mizan_user_role() = 'tenant_manager'
    AND tenant_id = private.mizan_user_tenant_id()
  )
);

CREATE POLICY update_own_profile ON public.profiles
FOR UPDATE TO authenticated
USING (
  id = (SELECT auth.uid())
  OR private.mizan_is_platform_admin()
  OR (
    private.mizan_user_role() = 'tenant_manager'
    AND tenant_id = private.mizan_user_tenant_id()
  )
)
WITH CHECK (
  (id = (SELECT auth.uid())
   AND tenant_id = private.mizan_user_tenant_id()
   AND role = (SELECT private.mizan_user_role()))
  OR private.mizan_is_platform_admin()
  OR (
    private.mizan_user_role() = 'tenant_manager'
    AND tenant_id = private.mizan_user_tenant_id()
    AND role <> 'accountant'
  )
);

CREATE POLICY insert_profile_admin ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  private.mizan_is_platform_admin()
  OR (
    private.mizan_user_role() = 'tenant_manager'
    AND tenant_id = private.mizan_user_tenant_id()
    AND role <> 'accountant'
  )
);

CREATE POLICY delete_profile_admin ON public.profiles
FOR DELETE TO authenticated
USING (private.mizan_is_platform_admin());

-- ---------------------------------------------------------------------------
-- 5. Project RLS: tenant isolation, with project management permissions
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS sel_projects ON public.projects;
DROP POLICY IF EXISTS ins_projects ON public.projects;
DROP POLICY IF EXISTS upd_projects ON public.projects;
DROP POLICY IF EXISTS del_projects ON public.projects;

CREATE POLICY sel_projects ON public.projects
FOR SELECT TO authenticated
USING (private.mizan_can_access_project(id));

CREATE POLICY ins_projects ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  private.mizan_is_platform_admin()
  OR (
    private.mizan_user_role() = 'tenant_manager'
    AND tenant_id = private.mizan_user_tenant_id()
  )
);

CREATE POLICY upd_projects ON public.projects
FOR UPDATE TO authenticated
USING (private.mizan_can_access_project(id))
WITH CHECK (
  private.mizan_can_access_project(id)
  AND (
    private.mizan_is_platform_admin()
    OR private.mizan_has_permission('project.manage')
  )
);

CREATE POLICY del_projects ON public.projects
FOR DELETE TO authenticated
USING (
  private.mizan_can_access_project(id)
  AND (private.mizan_is_platform_admin() OR private.mizan_user_role() = 'tenant_manager')
);

-- ---------------------------------------------------------------------------
-- 6. All project-scoped water tables: tenant isolation + operation policy
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'wells','pumps','tanks','customers','meters','meter_readings',
    'tariffs','invoices','payments','assets','faults','maintenance_work_orders',
    'field_tasks','notifications','kpi_snapshots'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS mizan_tenant_select ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY mizan_tenant_select ON public.%I FOR SELECT TO authenticated USING (private.mizan_can_access_project(project_id))',
      tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS mizan_tenant_insert ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY mizan_tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (private.mizan_can_write_project(project_id, %L, ''insert''))',
      tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS mizan_tenant_update ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY mizan_tenant_update ON public.%I FOR UPDATE TO authenticated USING (private.mizan_can_access_project(project_id)) WITH CHECK (private.mizan_can_write_project(project_id, %L, ''update''))',
      tbl, tbl
    );

    EXECUTE format('DROP POLICY IF EXISTS mizan_tenant_delete ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY mizan_tenant_delete ON public.%I FOR DELETE TO authenticated USING (private.mizan_can_write_project(project_id, %L, ''delete''))',
      tbl, tbl
    );
  END LOOP;
END $$;

-- tariff tiers do not have project_id; inherit scope from their tariff.
DROP POLICY IF EXISTS sel_tiers ON public.tariff_tiers;
DROP POLICY IF EXISTS ins_tiers ON public.tariff_tiers;
DROP POLICY IF EXISTS upd_tiers ON public.tariff_tiers;
DROP POLICY IF EXISTS del_tiers ON public.tariff_tiers;

CREATE POLICY sel_tiers ON public.tariff_tiers
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tariffs t
    WHERE t.id = tariff_tiers.tariff_id
      AND private.mizan_can_access_project(t.project_id)
  )
);

CREATE POLICY ins_tiers ON public.tariff_tiers
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tariffs t
    WHERE t.id = tariff_tiers.tariff_id
      AND private.mizan_can_write_project(t.project_id, 'tariff_tiers', 'insert')
  )
);

CREATE POLICY upd_tiers ON public.tariff_tiers
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tariffs t
    WHERE t.id = tariff_tiers.tariff_id
      AND private.mizan_can_access_project(t.project_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tariffs t
    WHERE t.id = tariff_tiers.tariff_id
      AND private.mizan_can_write_project(t.project_id, 'tariff_tiers', 'update')
  )
);

CREATE POLICY del_tiers ON public.tariff_tiers
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tariffs t
    WHERE t.id = tariff_tiers.tariff_id
      AND private.mizan_can_write_project(t.project_id, 'tariff_tiers', 'delete')
  )
);

-- ---------------------------------------------------------------------------
-- 7. Audit log: users can never write their own privileged history
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS sel_audit ON public.audit_logs;
DROP POLICY IF EXISTS ins_audit ON public.audit_logs;

CREATE POLICY sel_audit ON public.audit_logs
FOR SELECT TO authenticated
USING (
  private.mizan_is_platform_admin()
  OR (
    project_id IS NOT NULL
    AND private.mizan_can_access_project(project_id)
    AND private.mizan_has_permission('audit.read')
  )
);

CREATE POLICY ins_audit ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  false
);

-- ---------------------------------------------------------------------------
-- 8. AI logs: system-owned writes only; tenant-scoped reads
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS sel_ailogs ON public.ai_logs;
DROP POLICY IF EXISTS ins_ailogs ON public.ai_logs;

CREATE POLICY sel_ailogs ON public.ai_logs
FOR SELECT TO authenticated
USING (
  private.mizan_is_platform_admin()
  OR (project_id IS NOT NULL AND private.mizan_can_access_project(project_id))
);

CREATE POLICY ins_ailogs ON public.ai_logs
FOR INSERT TO authenticated
WITH CHECK (false);

-- Revoke direct table writes that would bypass the intended role model.
REVOKE ALL ON TABLE public.audit_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.ai_logs FROM authenticated;

-- Counters must not be client-writable; numbering will be moved behind controlled
-- server functions in the next hardening step.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.seq_counters FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.project_seq_counters FROM authenticated;

-- ---------------------------------------------------------------------------
-- 9. Indexes used by tenant-scoped RLS
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_parent_status ON public.tenants(parent_tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_project_id ON public.customers(project_id);
CREATE INDEX IF NOT EXISTS idx_meters_project_id ON public.meters(project_id);
CREATE INDEX IF NOT EXISTS idx_meter_readings_project_id ON public.meter_readings(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_project_id ON public.payments(project_id);
CREATE INDEX IF NOT EXISTS idx_faults_project_id ON public.faults(project_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_project_id ON public.maintenance_work_orders(project_id);

COMMENT ON TABLE public.mizan_role_permissions IS
  'Explicit MIZAN application RBAC catalogue. Database RLS remains authoritative.';
COMMENT ON TABLE public.mizan_permissions IS
  'MIZAN application permission catalogue. No ERP permissions are defined.';
