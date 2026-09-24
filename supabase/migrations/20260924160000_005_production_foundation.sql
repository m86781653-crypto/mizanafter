/*
# MIZAN AI — Production Foundation 005
## Tenant hierarchy + server-side meter-reading invariants

This migration is intentionally narrow:
- establishes main-tenant -> sub-tenant hierarchy without changing existing project data semantics
- adds tenant scope to profiles/projects for the next RLS migration
- defines production role vocabulary (no accountant role)
- adds server-side meter identity/reading consistency checks
- prevents more than one normal reading for the same meter on the same business day
- does NOT implement billing, OCR, offline sync, or UI changes yet

Existing project-scoped RLS remains in place until the dedicated tenant/RBAC migration.
*/

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name_ar text NOT NULL,
  name_en text,
  tenant_type text NOT NULL DEFAULT 'sub_tenant'
    CHECK (tenant_type IN ('main_tenant', 'sub_tenant')),
  timezone text NOT NULL DEFAULT 'Asia/Aden',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenants_main_has_no_parent
    CHECK (tenant_type <> 'main_tenant' OR parent_tenant_id IS NULL),
  CONSTRAINT tenants_sub_has_parent
    CHECK (tenant_type <> 'sub_tenant' OR parent_tenant_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_one_active_main_tenant
  ON public.tenants (tenant_type)
  WHERE tenant_type = 'main_tenant' AND status <> 'archived';

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON public.projects(tenant_id);

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_main_tenant_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.tenants t ON t.id = p.tenant_id
    WHERE p.id = auth.uid()
      AND t.tenant_type = 'main_tenant'
      AND t.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('tenant_manager', 'project_manager')
  );
$$;

COMMENT ON TABLE public.tenants IS
  'MIZAN governance boundary: one main tenant may own multiple isolated sub-tenants.';

COMMENT ON COLUMN public.profiles.tenant_id IS
  'Authorization scope. A user belongs to exactly one operational tenant once provisioned.';

COMMENT ON COLUMN public.projects.tenant_id IS
  'Operational project ownership boundary. Must match the project user tenant in the tenant/RLS migration.';

-- Production role vocabulary. Legacy roles remain readable for compatibility until the RBAC cutover.
CREATE TABLE IF NOT EXISTS public.mizan_role_catalog (
  role_code text PRIMARY KEY,
  name_ar text NOT NULL,
  description_ar text NOT NULL,
  is_legacy boolean NOT NULL DEFAULT false
);

INSERT INTO public.mizan_role_catalog (role_code, name_ar, description_ar, is_legacy)
VALUES
  ('platform_admin', 'مسؤول المنصة', 'إدارة المنصة والحوكمة التقنية العامة', false),
  ('tenant_manager', 'مدير المستأجر', 'إدارة وتشغيل المستأجر ضمن نطاقه', false),
  ('operations_officer', 'مسؤول التشغيل', 'تشغيل ومراقبة خدمات المياه والبنية التشغيلية', false),
  ('meter_reader', 'قارئ العدادات', 'التقاط قراءات العدادات والمهام الميدانية المسندة فقط', false),
  ('collection_officer', 'مسؤول التحصيل', 'تسجيل ومتابعة التحصيل ضمن نطاق الصلاحية', false),
  ('maintenance_officer', 'مسؤول الصيانة', 'إدارة بلاغات وأوامر الصيانة', false),
  ('technician', 'فني', 'تنفيذ أوامر العمل الفنية المسندة', false),
  ('data_exception_officer', 'مسؤول البيانات والاستثناءات', 'التحقيق في الاستثناءات والتصحيحات المقيدة', false),
  ('viewer', 'مطلع', 'قراءة فقط', false),
  ('super_admin', 'مسؤول منصة قديم', 'دور متوافق مؤقتاً أثناء الانتقال إلى platform_admin', true),
  ('project_manager', 'مدير مشروع قديم', 'دور متوافق مؤقتاً أثناء الانتقال إلى tenant_manager', true),
  ('collector', 'محصل قديم', 'دور متوافق مؤقتاً أثناء الانتقال إلى collection_officer', true),
  ('maintenance_tech', 'فني صيانة قديم', 'دور متوافق مؤقتاً أثناء الانتقال إلى technician', true),
  ('read_only', 'قراءة فقط قديم', 'دور متوافق مؤقتاً أثناء الانتقال إلى viewer', true)
ON CONFLICT (role_code) DO NOTHING;

-- Reject the removed Accountant role for newly changed profiles.
-- Existing legacy rows are not rewritten by this migration; the RBAC cutover will migrate them explicitly.
CREATE OR REPLACE FUNCTION public.prevent_removed_accountant_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'accountant' THEN
    RAISE EXCEPTION 'ROLE_REMOVED: accountant role is not part of the MIZAN production role model';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_removed_accountant_role ON public.profiles;
CREATE TRIGGER trg_prevent_removed_accountant_role
  BEFORE INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_removed_accountant_role();

-- Business-day is derived from the tenant/project timezone on the server.
ALTER TABLE public.meter_readings
  ADD COLUMN IF NOT EXISTS business_date date;

CREATE OR REPLACE FUNCTION public.set_meter_reading_business_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz text;
BEGIN
  SELECT COALESCE(t.timezone, 'Asia/Aden')
    INTO tz
  FROM public.projects p
  LEFT JOIN public.tenants t ON t.id = p.tenant_id
  WHERE p.id = NEW.project_id;

  NEW.business_date := (COALESCE(NEW.reading_date, now()) AT TIME ZONE COALESCE(tz, 'Asia/Aden'))::date;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meter_reading_business_date ON public.meter_readings;
CREATE TRIGGER trg_meter_reading_business_date
  BEFORE INSERT OR UPDATE OF reading_date, project_id
  ON public.meter_readings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_meter_reading_business_date();

-- One normal reading per meter per business day.
-- Exceptions/anomaly investigations are allowed to exist only when explicitly marked as exception.
CREATE UNIQUE INDEX IF NOT EXISTS ux_meter_readings_meter_business_day
  ON public.meter_readings (meter_id, business_date)
  WHERE status NOT IN ('exception', 'void');

CREATE OR REPLACE FUNCTION public.validate_meter_reading_invariants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.meters%ROWTYPE;
BEGIN
  SELECT *
    INTO m
  FROM public.meters
  WHERE id = NEW.meter_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'METER_NOT_FOUND';
  END IF;

  IF m.project_id <> NEW.project_id THEN
    RAISE EXCEPTION 'METER_PROJECT_MISMATCH';
  END IF;

  IF m.customer_id IS DISTINCT FROM NEW.customer_id THEN
    RAISE EXCEPTION 'METER_CUSTOMER_MISMATCH';
  END IF;

  IF NEW.reading_value IS NULL OR NEW.reading_value < 0 THEN
    RAISE EXCEPTION 'INVALID_READING_VALUE';
  END IF;

  IF NEW.previous_reading IS NULL OR NEW.previous_reading < 0 THEN
    RAISE EXCEPTION 'INVALID_PREVIOUS_READING';
  END IF;

  IF NEW.status NOT IN ('exception', 'void')
     AND NEW.reading_value < NEW.previous_reading THEN
    RAISE EXCEPTION 'READING_DECREASE_REQUIRES_EXCEPTION';
  END IF;

  IF NEW.consumption < 0 THEN
    RAISE EXCEPTION 'NEGATIVE_CONSUMPTION';
  END IF;

  IF NEW.consumption <> GREATEST(NEW.reading_value - NEW.previous_reading, 0)
     AND NEW.status NOT IN ('exception', 'void') THEN
    RAISE EXCEPTION 'CONSUMPTION_MISMATCH';
  END IF;

  IF NEW.ai_confidence IS NOT NULL
     AND (NEW.ai_confidence < 0 OR NEW.ai_confidence > 100) THEN
    RAISE EXCEPTION 'INVALID_AI_CONFIDENCE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_meter_reading_invariants ON public.meter_readings;
CREATE TRIGGER trg_validate_meter_reading_invariants
  BEFORE INSERT OR UPDATE
  ON public.meter_readings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meter_reading_invariants();

COMMENT ON COLUMN public.meter_readings.business_date IS
  'Server-derived business date in the project tenant timezone; never supplied by the field device.';

COMMENT ON INDEX public.ux_meter_readings_meter_business_day IS
  'Production duplicate guard: at most one non-exception/non-void reading per meter per business day.';
