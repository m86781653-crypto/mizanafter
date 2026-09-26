-- Normalize production role model around the approved four-role operating model.
-- Central governance: central_governance
-- Subtenant operations: project_manager, meter_reader, collection_officer
-- Legacy roles remain recognized for backward compatibility until data migration is completed.

INSERT INTO public.mizan_role_catalog (role_code,name_ar,description_ar,is_legacy)
VALUES
 ('central_governance','حوكمة هيئة مياه الريف','الحوكمة والإشراف المركزي وإدارة دورة إنشاء المستأجرين',false),
 ('project_manager','مدير المشروع','الإدارة التشغيلية والرقابة على مشروع المستأجر الفرعي',false)
ON CONFLICT (role_code) DO UPDATE
SET name_ar=excluded.name_ar,
    description_ar=excluded.description_ar,
    is_legacy=false;

UPDATE public.mizan_role_catalog
SET is_legacy=true,
    description_ar='دور انتقالي قديم؛ لا يُستخدم في الحسابات الجديدة'
WHERE role_code='tenant_manager';

INSERT INTO public.mizan_permissions(permission_code,name_ar,description_ar)
VALUES
 ('governance.tenant.manage','إدارة المستأجرين','إنشاء وإدارة المستأجرين ضمن الحوكمة المركزية'),
 ('governance.portfolio.read','قراءة المحفظة','قراءة مؤشرات ومشاريع المستأجرين التابعين للهيئة'),
 ('governance.financing.read','قراءة التمويل','قراءة بيانات التمويل والمصادر والمبالغ المعتمدة'),
 ('governance.users.provision','تهيئة المستخدمين','تهيئة الحسابات التشغيلية للمستأجر الفرعي'),
 ('governance.control.read','قراءة الرقابة','قراءة الاستثناءات وسجل الرقابة المركزي')
ON CONFLICT (permission_code) DO NOTHING;

DELETE FROM public.mizan_role_permissions
WHERE role_code IN ('central_governance','project_manager');

INSERT INTO public.mizan_role_permissions(role_code,permission_code)
VALUES
 ('central_governance','audit.read'),
 ('central_governance','governance.tenant.manage'),
 ('central_governance','governance.portfolio.read'),
 ('central_governance','governance.financing.read'),
 ('central_governance','governance.users.provision'),
 ('central_governance','governance.control.read'),
 ('central_governance','project.read'),
 ('project_manager','audit.read'),
 ('project_manager','billing.manage'),
 ('project_manager','collection.approve'),
 ('project_manager','customer.manage'),
 ('project_manager','data.exception'),
 ('project_manager','maintenance.manage'),
 ('project_manager','project.manage'),
 ('project_manager','project.read'),
 ('meter_reader','meter.capture'),
 ('meter_reader','project.read'),
 ('collection_officer','collection.record'),
 ('collection_officer','project.read')
ON CONFLICT DO NOTHING;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_allowed_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_allowed_chk
CHECK (role = ANY (ARRAY[
 'platform_admin','central_governance','project_manager','meter_reader','collection_officer',
 'operations_officer','maintenance_officer','technician','data_exception_officer','viewer',
 'tenant_manager','collector','maintenance_tech','read_only','super_admin'
]));

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
BEGIN
  IF target_project_id IS NULL OR private.mizan_user_tenant_id() IS NULL THEN
    RETURN false;
  END IF;

  IF private.mizan_is_platform_admin() THEN
    RETURN true;
  END IF;

  IF NOT private.mizan_can_access_project(target_project_id) THEN
    RETURN false;
  END IF;

  role_code := private.mizan_user_role();

  -- Central governance is oversight/setup, never routine subtenant operations.
  IF role_code = 'central_governance' THEN
    RETURN false;
  END IF;

  IF operation = 'delete' THEN
    RETURN role_code = 'project_manager'
      AND private.mizan_has_permission('project.manage');
  END IF;

  IF table_name = 'meter_readings' THEN
    RETURN operation = 'insert'
      AND private.mizan_has_permission('meter.capture');
  END IF;

  IF table_name = 'payments' THEN
    IF operation = 'insert' THEN
      RETURN private.mizan_has_permission('collection.record');
    END IF;
    IF operation = 'update' THEN
      RETURN private.mizan_has_permission('collection.approve');
    END IF;
    RETURN false;
  END IF;

  IF table_name IN ('invoices','tariffs','tariff_tiers') THEN
    RETURN private.mizan_has_permission('billing.manage');
  END IF;

  IF table_name IN ('customers','meters') THEN
    RETURN private.mizan_has_permission('customer.manage');
  END IF;

  IF table_name IN ('faults','maintenance_work_orders','service_interruptions') THEN
    RETURN private.mizan_has_permission('maintenance.manage')
      OR private.mizan_has_permission('maintenance.execute');
  END IF;

  IF table_name IN ('assets','wells','pumps','tanks') THEN
    RETURN private.mizan_has_permission('project.manage');
  END IF;

  IF table_name IN ('notifications','kpi_snapshots') THEN
    RETURN role_code = 'project_manager';
  END IF;

  IF table_name IN ('audit_logs','ai_logs') THEN
    RETURN false;
  END IF;

  RETURN private.mizan_has_permission('project.manage');
END
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';
  END IF;

  caller_tenant_id := private.mizan_user_tenant_id();

  IF private.mizan_user_role() <> 'central_governance'
     OR NOT private.mizan_has_permission('governance.tenant.manage') THEN
    RAISE EXCEPTION 'TENANT_CREATE_FORBIDDEN' USING ERRCODE='42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id=caller_tenant_id
      AND t.tenant_type='main_tenant'
      AND t.status='active'
  ) THEN
    RAISE EXCEPTION 'MAIN_TENANT_REQUIRED' USING ERRCODE='42501';
  END IF;

  IF nullif(trim(p_name_ar),'') IS NULL THEN
    RAISE EXCEPTION 'TENANT_NAME_REQUIRED' USING ERRCODE='22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.parent_tenant_id=caller_tenant_id
      AND lower(trim(t.name_ar))=lower(trim(p_name_ar))
      AND t.status<>'archived'
  ) THEN
    RAISE EXCEPTION 'TENANT_NAME_EXISTS' USING ERRCODE='23505';
  END IF;

  INSERT INTO public.tenants(parent_tenant_id,name_ar,name_en,tenant_type,timezone,status)
  VALUES(
    caller_tenant_id,
    trim(p_name_ar),
    nullif(trim(p_name_en),''),
    'sub_tenant',
    coalesce(nullif(trim(p_timezone),''),'Asia/Aden'),
    'active'
  )
  RETURNING id INTO new_tenant_id;

  INSERT INTO public.audit_logs(
    table_name,record_id,action,user_id,actor_user_id,entity_type,entity_id,
    new_values,result,reason
  )
  VALUES(
    'tenants',new_tenant_id,'CREATE',auth.uid(),auth.uid(),'tenant',new_tenant_id,
    jsonb_build_object(
      'parent_tenant_id',caller_tenant_id,
      'name_ar',trim(p_name_ar),
      'tenant_type','sub_tenant',
      'status','active'
    ),
    'accepted','central_governance_created_subtenant'
  );

  RETURN new_tenant_id;
END
$function$;

REVOKE ALL ON FUNCTION public.mizan_create_subtenant(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mizan_create_subtenant(text,text,text) TO authenticated;

-- Project master-data writes are now allowed for the central governance role
-- only when the target project belongs to the central tenant's child portfolio.
DROP POLICY IF EXISTS ins_projects ON public.projects;
CREATE POLICY ins_projects ON public.projects
FOR INSERT TO authenticated
WITH CHECK (
  private.mizan_is_platform_admin()
  OR (
    private.mizan_user_role()='project_manager'
    AND tenant_id=private.mizan_user_tenant_id()
  )
  OR (
    private.mizan_user_role()='central_governance'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id=tenant_id
        AND t.tenant_type='sub_tenant'
        AND t.parent_tenant_id=private.mizan_user_tenant_id()
        AND t.status='active'
    )
  )
);

DROP POLICY IF EXISTS upd_projects ON public.projects;
CREATE POLICY upd_projects ON public.projects
FOR UPDATE TO authenticated
USING (private.mizan_can_access_project(id))
WITH CHECK (
  private.mizan_is_platform_admin()
  OR (
    private.mizan_user_role()='project_manager'
    AND tenant_id=private.mizan_user_tenant_id()
  )
  OR (
    private.mizan_user_role()='central_governance'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id=tenant_id
        AND t.tenant_type='sub_tenant'
        AND t.parent_tenant_id=private.mizan_user_tenant_id()
        AND t.status='active'
    )
  )
);

REVOKE ALL ON FUNCTION private.mizan_can_write_project(uuid,text,text) FROM PUBLIC, anon, authenticated;
