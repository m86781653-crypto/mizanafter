/*
# MIZAN AI — Add Authentication, Project Isolation, and User Profiles

## Purpose
Transforms the system from open demo mode to a production multi-tenant system with:
1. User profiles linked to auth.users with role + project_id assignment
2. Project-level data isolation — every user sees ONLY their project's data
3. Super admin role can see all projects
4. All RLS policies rewritten for authenticated-only access with project scoping

## New Tables
- `profiles` — extends auth.users with role, project_id, full_name, phone
  - role: 'super_admin' | 'project_manager' | 'meter_reader' | 'collector' | 'accountant' | 'maintenance_tech' | 'read_only'
  - project_id: nullable FK to projects (null for super_admin who sees all)
  - full_name: Arabic display name
  - phone: contact phone
  - must_change_password: boolean flag for initial password

## Security Changes
1. profiles table: RLS enabled, users can read/update own profile, super_admin can read all
2. All data tables: RLS policies changed from `TO anon, authenticated USING (true)` 
   to `TO authenticated` with project-scoped checks
3. projects table: super_admin sees all, project users see only their assigned project

## Important Notes
1. After this migration, the anon key can NO LONGER read/write data — only authenticated users can
2. A `handle_new_user` trigger auto-creates a profile row when a new auth.user is created
3. Helper functions: is_super_admin(), get_user_project_id()
4. To bootstrap: an edge function uses the service role key to create the first super_admin user
*/

-- ============================================================
-- PROFILES TABLE (must be created BEFORE helper functions that reference it)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'read_only',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  phone text,
  must_change_password boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper Functions (now profiles table exists)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_project_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT project_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- Profiles RLS
-- ============================================================
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_super_admin());

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_super_admin())
  WITH CHECK (auth.uid() = id OR public.is_super_admin());

DROP POLICY IF EXISTS "insert_profile_admin" ON public.profiles;
CREATE POLICY "insert_profile_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id OR public.is_super_admin());

DROP POLICY IF EXISTS "delete_profile_admin" ON public.profiles;
CREATE POLICY "delete_profile_admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- Auto-create profile when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, must_change_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'read_only'),
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, true)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PROJECTS — super_admin sees all, project users see their project
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_projects" ON public.projects;
DROP POLICY IF EXISTS "anon_ins_projects" ON public.projects;
DROP POLICY IF EXISTS "anon_upd_projects" ON public.projects;
DROP POLICY IF EXISTS "anon_del_projects" ON public.projects;

DROP POLICY IF EXISTS "sel_projects" ON public.projects;
CREATE POLICY "sel_projects" ON public.projects
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_projects" ON public.projects;
CREATE POLICY "ins_projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "upd_projects" ON public.projects;
CREATE POLICY "upd_projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_projects" ON public.projects;
CREATE POLICY "del_projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ============================================================
-- WELLS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_wells" ON public.wells;
DROP POLICY IF EXISTS "anon_ins_wells" ON public.wells;
DROP POLICY IF EXISTS "anon_upd_wells" ON public.wells;
DROP POLICY IF EXISTS "anon_del_wells" ON public.wells;

DROP POLICY IF EXISTS "sel_wells" ON public.wells;
CREATE POLICY "sel_wells" ON public.wells
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_wells" ON public.wells;
CREATE POLICY "ins_wells" ON public.wells
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "upd_wells" ON public.wells;
CREATE POLICY "upd_wells" ON public.wells
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_wells" ON public.wells;
CREATE POLICY "del_wells" ON public.wells
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- PUMPS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_pumps" ON public.pumps;
DROP POLICY IF EXISTS "anon_ins_pumps" ON public.pumps;
DROP POLICY IF EXISTS "anon_upd_pumps" ON public.pumps;
DROP POLICY IF EXISTS "anon_del_pumps" ON public.pumps;

DROP POLICY IF EXISTS "sel_pumps" ON public.pumps;
CREATE POLICY "sel_pumps" ON public.pumps
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_pumps" ON public.pumps;
CREATE POLICY "ins_pumps" ON public.pumps
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "upd_pumps" ON public.pumps;
CREATE POLICY "upd_pumps" ON public.pumps
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_pumps" ON public.pumps;
CREATE POLICY "del_pumps" ON public.pumps
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- TANKS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_tanks" ON public.tanks;
DROP POLICY IF EXISTS "anon_ins_tanks" ON public.tanks;
DROP POLICY IF EXISTS "anon_upd_tanks" ON public.tanks;
DROP POLICY IF EXISTS "anon_del_tanks" ON public.tanks;

DROP POLICY IF EXISTS "sel_tanks" ON public.tanks;
CREATE POLICY "sel_tanks" ON public.tanks
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_tanks" ON public.tanks;
CREATE POLICY "ins_tanks" ON public.tanks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "upd_tanks" ON public.tanks;
CREATE POLICY "upd_tanks" ON public.tanks
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_tanks" ON public.tanks;
CREATE POLICY "del_tanks" ON public.tanks
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- CUSTOMERS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_customers" ON public.customers;
DROP POLICY IF EXISTS "anon_ins_customers" ON public.customers;
DROP POLICY IF EXISTS "anon_upd_customers" ON public.customers;
DROP POLICY IF EXISTS "anon_del_customers" ON public.customers;

DROP POLICY IF EXISTS "sel_customers" ON public.customers;
CREATE POLICY "sel_customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_customers" ON public.customers;
CREATE POLICY "ins_customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "upd_customers" ON public.customers;
CREATE POLICY "upd_customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_customers" ON public.customers;
CREATE POLICY "del_customers" ON public.customers
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- METERS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_meters" ON public.meters;
DROP POLICY IF EXISTS "anon_ins_meters" ON public.meters;
DROP POLICY IF EXISTS "anon_upd_meters" ON public.meters;
DROP POLICY IF EXISTS "anon_del_meters" ON public.meters;

DROP POLICY IF EXISTS "sel_meters" ON public.meters;
CREATE POLICY "sel_meters" ON public.meters
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_meters" ON public.meters;
CREATE POLICY "ins_meters" ON public.meters
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "upd_meters" ON public.meters;
CREATE POLICY "upd_meters" ON public.meters
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_meters" ON public.meters;
CREATE POLICY "del_meters" ON public.meters
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- METER_READINGS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_readings" ON public.meter_readings;
DROP POLICY IF EXISTS "anon_ins_readings" ON public.meter_readings;
DROP POLICY IF EXISTS "anon_upd_readings" ON public.meter_readings;
DROP POLICY IF EXISTS "anon_del_readings" ON public.meter_readings;

DROP POLICY IF EXISTS "sel_readings" ON public.meter_readings;
CREATE POLICY "sel_readings" ON public.meter_readings
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_readings" ON public.meter_readings;
CREATE POLICY "ins_readings" ON public.meter_readings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "upd_readings" ON public.meter_readings;
CREATE POLICY "upd_readings" ON public.meter_readings
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_readings" ON public.meter_readings;
CREATE POLICY "del_readings" ON public.meter_readings
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- TARIFFS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_tariffs" ON public.tariffs;
DROP POLICY IF EXISTS "anon_ins_tariffs" ON public.tariffs;
DROP POLICY IF EXISTS "anon_upd_tariffs" ON public.tariffs;
DROP POLICY IF EXISTS "anon_del_tariffs" ON public.tariffs;

DROP POLICY IF EXISTS "sel_tariffs" ON public.tariffs;
CREATE POLICY "sel_tariffs" ON public.tariffs
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_tariffs" ON public.tariffs;
CREATE POLICY "ins_tariffs" ON public.tariffs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "upd_tariffs" ON public.tariffs;
CREATE POLICY "upd_tariffs" ON public.tariffs
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_tariffs" ON public.tariffs;
CREATE POLICY "del_tariffs" ON public.tariffs
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- TARIFF_TIERS — scoped through parent tariff's project
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_tiers" ON public.tariff_tiers;
DROP POLICY IF EXISTS "anon_ins_tiers" ON public.tariff_tiers;
DROP POLICY IF EXISTS "anon_upd_tiers" ON public.tariff_tiers;
DROP POLICY IF EXISTS "anon_del_tiers" ON public.tariff_tiers;

DROP POLICY IF EXISTS "sel_tiers" ON public.tariff_tiers;
CREATE POLICY "sel_tiers" ON public.tariff_tiers
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tariffs t WHERE t.id = tariff_tiers.tariff_id AND t.project_id = public.get_user_project_id()));

DROP POLICY IF EXISTS "ins_tiers" ON public.tariff_tiers;
CREATE POLICY "ins_tiers" ON public.tariff_tiers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tariffs t WHERE t.id = tariff_tiers.tariff_id AND t.project_id = public.get_user_project_id()));

DROP POLICY IF EXISTS "upd_tiers" ON public.tariff_tiers;
CREATE POLICY "upd_tiers" ON public.tariff_tiers
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tariffs t WHERE t.id = tariff_tiers.tariff_id AND t.project_id = public.get_user_project_id()));

DROP POLICY IF EXISTS "del_tiers" ON public.tariff_tiers;
CREATE POLICY "del_tiers" ON public.tariff_tiers
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR EXISTS (SELECT 1 FROM public.tariffs t WHERE t.id = tariff_tiers.tariff_id AND t.project_id = public.get_user_project_id()));

-- ============================================================
-- INVOICES — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_invoices" ON public.invoices;
DROP POLICY IF EXISTS "anon_ins_invoices" ON public.invoices;
DROP POLICY IF EXISTS "anon_upd_invoices" ON public.invoices;
DROP POLICY IF EXISTS "anon_del_invoices" ON public.invoices;

DROP POLICY IF EXISTS "sel_invoices" ON public.invoices;
CREATE POLICY "sel_invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_invoices" ON public.invoices;
CREATE POLICY "ins_invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "upd_invoices" ON public.invoices;
CREATE POLICY "upd_invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_invoices" ON public.invoices;
CREATE POLICY "del_invoices" ON public.invoices
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- PAYMENTS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_payments" ON public.payments;
DROP POLICY IF EXISTS "anon_ins_payments" ON public.payments;
DROP POLICY IF EXISTS "anon_upd_payments" ON public.payments;
DROP POLICY IF EXISTS "anon_del_payments" ON public.payments;

DROP POLICY IF EXISTS "sel_payments" ON public.payments;
CREATE POLICY "sel_payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "ins_payments" ON public.payments;
CREATE POLICY "ins_payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "upd_payments" ON public.payments;
CREATE POLICY "upd_payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id())
  WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());

DROP POLICY IF EXISTS "del_payments" ON public.payments;
CREATE POLICY "del_payments" ON public.payments
  FOR DELETE TO authenticated
  USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- ASSETS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_assets" ON public.assets;
DROP POLICY IF EXISTS "anon_ins_assets" ON public.assets;
DROP POLICY IF EXISTS "anon_upd_assets" ON public.assets;
DROP POLICY IF EXISTS "anon_del_assets" ON public.assets;

DROP POLICY IF EXISTS "sel_assets" ON public.assets;
CREATE POLICY "sel_assets" ON public.assets
  FOR SELECT TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "ins_assets" ON public.assets;
CREATE POLICY "ins_assets" ON public.assets
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "upd_assets" ON public.assets;
CREATE POLICY "upd_assets" ON public.assets
  FOR UPDATE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id()) WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "del_assets" ON public.assets;
CREATE POLICY "del_assets" ON public.assets
  FOR DELETE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- FAULTS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_faults" ON public.faults;
DROP POLICY IF EXISTS "anon_ins_faults" ON public.faults;
DROP POLICY IF EXISTS "anon_upd_faults" ON public.faults;
DROP POLICY IF EXISTS "anon_del_faults" ON public.faults;

DROP POLICY IF EXISTS "sel_faults" ON public.faults;
CREATE POLICY "sel_faults" ON public.faults FOR SELECT TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "ins_faults" ON public.faults;
CREATE POLICY "ins_faults" ON public.faults FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "upd_faults" ON public.faults;
CREATE POLICY "upd_faults" ON public.faults FOR UPDATE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id()) WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "del_faults" ON public.faults;
CREATE POLICY "del_faults" ON public.faults FOR DELETE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- MAINTENANCE_WORK_ORDERS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_mwo" ON public.maintenance_work_orders;
DROP POLICY IF EXISTS "anon_ins_mwo" ON public.maintenance_work_orders;
DROP POLICY IF EXISTS "anon_upd_mwo" ON public.maintenance_work_orders;
DROP POLICY IF EXISTS "anon_del_mwo" ON public.maintenance_work_orders;

DROP POLICY IF EXISTS "sel_mwo" ON public.maintenance_work_orders;
CREATE POLICY "sel_mwo" ON public.maintenance_work_orders FOR SELECT TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "ins_mwo" ON public.maintenance_work_orders;
CREATE POLICY "ins_mwo" ON public.maintenance_work_orders FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "upd_mwo" ON public.maintenance_work_orders;
CREATE POLICY "upd_mwo" ON public.maintenance_work_orders FOR UPDATE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id()) WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "del_mwo" ON public.maintenance_work_orders;
CREATE POLICY "del_mwo" ON public.maintenance_work_orders FOR DELETE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- FIELD_TASKS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_ftasks" ON public.field_tasks;
DROP POLICY IF EXISTS "anon_ins_ftasks" ON public.field_tasks;
DROP POLICY IF EXISTS "anon_upd_ftasks" ON public.field_tasks;
DROP POLICY IF EXISTS "anon_del_ftasks" ON public.field_tasks;

DROP POLICY IF EXISTS "sel_ftasks" ON public.field_tasks;
CREATE POLICY "sel_ftasks" ON public.field_tasks FOR SELECT TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "ins_ftasks" ON public.field_tasks;
CREATE POLICY "ins_ftasks" ON public.field_tasks FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "upd_ftasks" ON public.field_tasks;
CREATE POLICY "upd_ftasks" ON public.field_tasks FOR UPDATE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id()) WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "del_ftasks" ON public.field_tasks;
CREATE POLICY "del_ftasks" ON public.field_tasks FOR DELETE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- NOTIFICATIONS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_notifs" ON public.notifications;
DROP POLICY IF EXISTS "anon_ins_notifs" ON public.notifications;
DROP POLICY IF EXISTS "anon_upd_notifs" ON public.notifications;
DROP POLICY IF EXISTS "anon_del_notifs" ON public.notifications;

DROP POLICY IF EXISTS "sel_notifs" ON public.notifications;
CREATE POLICY "sel_notifs" ON public.notifications FOR SELECT TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "ins_notifs" ON public.notifications;
CREATE POLICY "ins_notifs" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "upd_notifs" ON public.notifications;
CREATE POLICY "upd_notifs" ON public.notifications FOR UPDATE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id()) WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "del_notifs" ON public.notifications;
CREATE POLICY "del_notifs" ON public.notifications FOR DELETE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- AUDIT_LOGS — super_admin read, any authenticated insert
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_audit" ON public.audit_logs;
DROP POLICY IF EXISTS "anon_ins_audit" ON public.audit_logs;
DROP POLICY IF EXISTS "anon_upd_audit" ON public.audit_logs;
DROP POLICY IF EXISTS "anon_del_audit" ON public.audit_logs;

DROP POLICY IF EXISTS "sel_audit" ON public.audit_logs;
CREATE POLICY "sel_audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "ins_audit" ON public.audit_logs;
CREATE POLICY "ins_audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- AI_LOGS — super_admin read, any authenticated insert
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_ailogs" ON public.ai_logs;
DROP POLICY IF EXISTS "anon_ins_ailogs" ON public.ai_logs;
DROP POLICY IF EXISTS "anon_upd_ailogs" ON public.ai_logs;
DROP POLICY IF EXISTS "anon_del_ailogs" ON public.ai_logs;

DROP POLICY IF EXISTS "sel_ailogs" ON public.ai_logs;
CREATE POLICY "sel_ailogs" ON public.ai_logs FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "ins_ailogs" ON public.ai_logs;
CREATE POLICY "ins_ailogs" ON public.ai_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- KPI_SNAPSHOTS — project scoped
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_kpi" ON public.kpi_snapshots;
DROP POLICY IF EXISTS "anon_ins_kpi" ON public.kpi_snapshots;
DROP POLICY IF EXISTS "anon_upd_kpi" ON public.kpi_snapshots;
DROP POLICY IF EXISTS "anon_del_kpi" ON public.kpi_snapshots;

DROP POLICY IF EXISTS "sel_kpi" ON public.kpi_snapshots;
CREATE POLICY "sel_kpi" ON public.kpi_snapshots FOR SELECT TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "ins_kpi" ON public.kpi_snapshots;
CREATE POLICY "ins_kpi" ON public.kpi_snapshots FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "upd_kpi" ON public.kpi_snapshots;
CREATE POLICY "upd_kpi" ON public.kpi_snapshots FOR UPDATE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id()) WITH CHECK (public.is_super_admin() OR project_id = public.get_user_project_id());
DROP POLICY IF EXISTS "del_kpi" ON public.kpi_snapshots;
CREATE POLICY "del_kpi" ON public.kpi_snapshots FOR DELETE TO authenticated USING (public.is_super_admin() OR project_id = public.get_user_project_id());

-- ============================================================
-- REGIONS, DISTRICTS, ORGANIZATIONS — readable by all authenticated, admin write
-- ============================================================
DROP POLICY IF EXISTS "anon_sel_regions" ON public.regions;
DROP POLICY IF EXISTS "anon_ins_regions" ON public.regions;
DROP POLICY IF EXISTS "anon_upd_regions" ON public.regions;
DROP POLICY IF EXISTS "anon_del_regions" ON public.regions;

DROP POLICY IF EXISTS "sel_regions" ON public.regions;
CREATE POLICY "sel_regions" ON public.regions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ins_regions" ON public.regions;
CREATE POLICY "ins_regions" ON public.regions FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "upd_regions" ON public.regions;
CREATE POLICY "upd_regions" ON public.regions FOR UPDATE TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "del_regions" ON public.regions;
CREATE POLICY "del_regions" ON public.regions FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "anon_sel_districts" ON public.districts;
DROP POLICY IF EXISTS "anon_ins_districts" ON public.districts;
DROP POLICY IF EXISTS "anon_upd_districts" ON public.districts;
DROP POLICY IF EXISTS "anon_del_districts" ON public.districts;

DROP POLICY IF EXISTS "sel_districts" ON public.districts;
CREATE POLICY "sel_districts" ON public.districts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ins_districts" ON public.districts;
CREATE POLICY "ins_districts" ON public.districts FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "upd_districts" ON public.districts;
CREATE POLICY "upd_districts" ON public.districts FOR UPDATE TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "del_districts" ON public.districts;
CREATE POLICY "del_districts" ON public.districts FOR DELETE TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "anon_sel_orgs" ON public.organizations;
DROP POLICY IF EXISTS "anon_ins_orgs" ON public.organizations;
DROP POLICY IF EXISTS "anon_upd_orgs" ON public.organizations;
DROP POLICY IF EXISTS "anon_del_orgs" ON public.organizations;

DROP POLICY IF EXISTS "sel_orgs" ON public.organizations;
CREATE POLICY "sel_orgs" ON public.organizations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ins_orgs" ON public.organizations;
CREATE POLICY "ins_orgs" ON public.organizations FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS "upd_orgs" ON public.organizations;
CREATE POLICY "upd_orgs" ON public.organizations FOR UPDATE TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "del_orgs" ON public.organizations;
CREATE POLICY "del_orgs" ON public.organizations FOR DELETE TO authenticated USING (public.is_super_admin());
