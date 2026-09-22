/*
# MIZAN AI — Core Database Schema
## Creates foundational schema for the water management platform.
## Tables: regions, districts, organizations, projects, wells, pumps, tanks,
## customers, meters, meter_readings, tariffs, tariff_tiers, invoices, payments,
## assets, faults, maintenance_work_orders, field_tasks, notifications,
## audit_logs, ai_logs, kpi_snapshots
## Security: RLS on all tables, anon+authenticated CRUD (single-tenant demo)
*/

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS regions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name_ar text NOT NULL, name_en text, code text UNIQUE, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_regions" ON regions; CREATE POLICY "anon_sel_regions" ON regions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_regions" ON regions; CREATE POLICY "anon_ins_regions" ON regions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_regions" ON regions; CREATE POLICY "anon_upd_regions" ON regions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_regions" ON regions; CREATE POLICY "anon_del_regions" ON regions FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS districts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), region_id uuid REFERENCES regions(id) ON DELETE SET NULL, name_ar text NOT NULL, name_en text, code text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_districts" ON districts; CREATE POLICY "anon_sel_districts" ON districts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_districts" ON districts; CREATE POLICY "anon_ins_districts" ON districts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_districts" ON districts; CREATE POLICY "anon_upd_districts" ON districts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_districts" ON districts; CREATE POLICY "anon_del_districts" ON districts FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name_ar text NOT NULL, name_en text, type text DEFAULT 'local_utility', phone text, email text, address text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_orgs" ON organizations; CREATE POLICY "anon_sel_orgs" ON organizations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_orgs" ON organizations; CREATE POLICY "anon_ins_orgs" ON organizations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_orgs" ON organizations; CREATE POLICY "anon_upd_orgs" ON organizations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_orgs" ON organizations; CREATE POLICY "anon_del_orgs" ON organizations FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name_ar text NOT NULL, name_en text, organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL, district_id uuid REFERENCES districts(id) ON DELETE SET NULL, status text DEFAULT 'active', funding_source text, donor text, beneficiary_count int DEFAULT 0, design_capacity numeric DEFAULT 0, operational_capacity numeric DEFAULT 0, location geography(POINT, 4326), address text, established_date date, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_projects" ON projects; CREATE POLICY "anon_sel_projects" ON projects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_projects" ON projects; CREATE POLICY "anon_ins_projects" ON projects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_projects" ON projects; CREATE POLICY "anon_upd_projects" ON projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_projects" ON projects; CREATE POLICY "anon_del_projects" ON projects FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS wells (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, code text NOT NULL, name_ar text, depth_m numeric, status text DEFAULT 'operational', water_source text, capacity_m3_h numeric, daily_output_m3 numeric DEFAULT 0, operating_hours numeric DEFAULT 0, pump_installed boolean DEFAULT false, water_level_m numeric, location geography(POINT, 4326), installation_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE wells ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_wells" ON wells; CREATE POLICY "anon_sel_wells" ON wells FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_wells" ON wells; CREATE POLICY "anon_ins_wells" ON wells FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_wells" ON wells; CREATE POLICY "anon_upd_wells" ON wells FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_wells" ON wells; CREATE POLICY "anon_del_wells" ON wells FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_wells_project ON wells(project_id);

CREATE TABLE IF NOT EXISTS pumps (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, well_id uuid REFERENCES wells(id) ON DELETE SET NULL, code text NOT NULL, manufacturer text, model text, serial_number text, power_kw numeric, flow_rate_m3_h numeric, head_m numeric, status text DEFAULT 'operational', operating_hours numeric DEFAULT 0, efficiency numeric, installation_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE pumps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_pumps" ON pumps; CREATE POLICY "anon_sel_pumps" ON pumps FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_pumps" ON pumps; CREATE POLICY "anon_ins_pumps" ON pumps FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_pumps" ON pumps; CREATE POLICY "anon_upd_pumps" ON pumps FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_pumps" ON pumps; CREATE POLICY "anon_del_pumps" ON pumps FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_pumps_project ON pumps(project_id);
CREATE INDEX IF NOT EXISTS idx_pumps_well ON pumps(well_id);

CREATE TABLE IF NOT EXISTS tanks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, code text NOT NULL, name_ar text, capacity_m3 numeric, current_level_m3 numeric, material text, elevation_m numeric, status text DEFAULT 'operational', location geography(POINT, 4326), installation_date date, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE tanks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_tanks" ON tanks; CREATE POLICY "anon_sel_tanks" ON tanks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_tanks" ON tanks; CREATE POLICY "anon_ins_tanks" ON tanks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_tanks" ON tanks; CREATE POLICY "anon_upd_tanks" ON tanks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_tanks" ON tanks; CREATE POLICY "anon_del_tanks" ON tanks FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_tanks_project ON tanks(project_id);

CREATE TABLE IF NOT EXISTS customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, customer_number text NOT NULL, name_ar text NOT NULL, phone text, address text, customer_type text DEFAULT 'residential', location geography(POINT, 4326), status text DEFAULT 'active', connection_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_customers" ON customers; CREATE POLICY "anon_sel_customers" ON customers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_customers" ON customers; CREATE POLICY "anon_ins_customers" ON customers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_customers" ON customers; CREATE POLICY "anon_upd_customers" ON customers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_customers" ON customers; CREATE POLICY "anon_del_customers" ON customers FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_customers_project ON customers(project_id);
CREATE INDEX IF NOT EXISTS idx_customers_number ON customers(customer_number);

CREATE TABLE IF NOT EXISTS meters (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, meter_number text NOT NULL, serial_number text, meter_type text DEFAULT 'mechanical', size_mm int, status text DEFAULT 'active', installation_date date, last_reading numeric DEFAULT 0, last_reading_date timestamptz, location geography(POINT, 4326), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_meters" ON meters; CREATE POLICY "anon_sel_meters" ON meters FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_meters" ON meters; CREATE POLICY "anon_ins_meters" ON meters FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_meters" ON meters; CREATE POLICY "anon_upd_meters" ON meters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_meters" ON meters; CREATE POLICY "anon_del_meters" ON meters FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_meters_project ON meters(project_id);
CREATE INDEX IF NOT EXISTS idx_meters_customer ON meters(customer_id);

CREATE TABLE IF NOT EXISTS meter_readings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), meter_id uuid NOT NULL REFERENCES meters(id) ON DELETE CASCADE, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, reading_value numeric NOT NULL, previous_reading numeric DEFAULT 0, consumption numeric DEFAULT 0, reading_date timestamptz DEFAULT now(), reading_method text DEFAULT 'manual', image_url text, ai_extracted_value numeric, ai_confidence numeric, ai_model text, status text DEFAULT 'pending', anomaly_flag boolean DEFAULT false, anomaly_reason text, gps_lat numeric, gps_lng numeric, gps_accuracy numeric, sync_status text DEFAULT 'synced', reader_name text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_readings" ON meter_readings; CREATE POLICY "anon_sel_readings" ON meter_readings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_readings" ON meter_readings; CREATE POLICY "anon_ins_readings" ON meter_readings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_readings" ON meter_readings; CREATE POLICY "anon_upd_readings" ON meter_readings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_readings" ON meter_readings; CREATE POLICY "anon_del_readings" ON meter_readings FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_readings_meter ON meter_readings(meter_id);
CREATE INDEX IF NOT EXISTS idx_readings_project ON meter_readings(project_id);
CREATE INDEX IF NOT EXISTS idx_readings_status ON meter_readings(status);

CREATE TABLE IF NOT EXISTS tariffs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES projects(id) ON DELETE CASCADE, name_ar text NOT NULL, customer_type text DEFAULT 'residential', fixed_fee numeric DEFAULT 0, effective_from date NOT NULL DEFAULT CURRENT_DATE, effective_to date, is_active boolean DEFAULT true, version int DEFAULT 1, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_tariffs" ON tariffs; CREATE POLICY "anon_sel_tariffs" ON tariffs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_tariffs" ON tariffs; CREATE POLICY "anon_ins_tariffs" ON tariffs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_tariffs" ON tariffs; CREATE POLICY "anon_upd_tariffs" ON tariffs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_tariffs" ON tariffs; CREATE POLICY "anon_del_tariffs" ON tariffs FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_tariffs_project ON tariffs(project_id);

CREATE TABLE IF NOT EXISTS tariff_tiers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tariff_id uuid NOT NULL REFERENCES tariffs(id) ON DELETE CASCADE, from_m3 numeric NOT NULL DEFAULT 0, to_m3 numeric, price_per_m3 numeric NOT NULL, created_at timestamptz DEFAULT now());
ALTER TABLE tariff_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_tiers" ON tariff_tiers; CREATE POLICY "anon_sel_tiers" ON tariff_tiers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_tiers" ON tariff_tiers; CREATE POLICY "anon_ins_tiers" ON tariff_tiers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_tiers" ON tariff_tiers; CREATE POLICY "anon_upd_tiers" ON tariff_tiers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_tiers" ON tariff_tiers; CREATE POLICY "anon_del_tiers" ON tariff_tiers FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE, meter_id uuid REFERENCES meters(id) ON DELETE SET NULL, invoice_number text NOT NULL, billing_period_start date NOT NULL, billing_period_end date NOT NULL, previous_reading numeric DEFAULT 0, current_reading numeric DEFAULT 0, consumption_m3 numeric DEFAULT 0, fixed_fee numeric DEFAULT 0, consumption_fee numeric DEFAULT 0, total_amount numeric DEFAULT 0, previous_balance numeric DEFAULT 0, grand_total numeric DEFAULT 0, amount_paid numeric DEFAULT 0, balance numeric DEFAULT 0, status text DEFAULT 'unpaid', issue_date timestamptz DEFAULT now(), due_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_invoices" ON invoices; CREATE POLICY "anon_sel_invoices" ON invoices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_invoices" ON invoices; CREATE POLICY "anon_ins_invoices" ON invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_invoices" ON invoices; CREATE POLICY "anon_upd_invoices" ON invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_invoices" ON invoices; CREATE POLICY "anon_del_invoices" ON invoices FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL, customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, receipt_number text NOT NULL, amount numeric NOT NULL, payment_method text DEFAULT 'cash', collector_name text, payment_date timestamptz DEFAULT now(), reference_number text, notes text, created_at timestamptz DEFAULT now());
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_payments" ON payments; CREATE POLICY "anon_sel_payments" ON payments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_payments" ON payments; CREATE POLICY "anon_ins_payments" ON payments FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_payments" ON payments; CREATE POLICY "anon_upd_payments" ON payments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_payments" ON payments; CREATE POLICY "anon_del_payments" ON payments FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_payments_project ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);

CREATE TABLE IF NOT EXISTS assets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, asset_code text NOT NULL, name_ar text NOT NULL, category text, type text, manufacturer text, model text, serial_number text, status text DEFAULT 'operational', purchase_date date, purchase_cost numeric, expected_lifespan_years numeric, location geography(POINT, 4326), installation_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_assets" ON assets; CREATE POLICY "anon_sel_assets" ON assets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_assets" ON assets; CREATE POLICY "anon_ins_assets" ON assets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_assets" ON assets; CREATE POLICY "anon_upd_assets" ON assets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_assets" ON assets; CREATE POLICY "anon_del_assets" ON assets FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);

CREATE TABLE IF NOT EXISTS faults (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, fault_number text NOT NULL, asset_id uuid REFERENCES assets(id) ON DELETE SET NULL, well_id uuid REFERENCES wells(id) ON DELETE SET NULL, pump_id uuid REFERENCES pumps(id) ON DELETE SET NULL, reported_by text, reporter_type text DEFAULT 'staff', fault_type text, severity text DEFAULT 'medium', status text DEFAULT 'reported', description text, location geography(POINT, 4326), reported_at timestamptz DEFAULT now(), verified_at timestamptz, resolved_at timestamptz, assigned_team text, resolution_notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE faults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_faults" ON faults; CREATE POLICY "anon_sel_faults" ON faults FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_faults" ON faults; CREATE POLICY "anon_ins_faults" ON faults FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_faults" ON faults; CREATE POLICY "anon_upd_faults" ON faults FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_faults" ON faults; CREATE POLICY "anon_del_faults" ON faults FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_faults_project ON faults(project_id);
CREATE INDEX IF NOT EXISTS idx_faults_status ON faults(status);

CREATE TABLE IF NOT EXISTS maintenance_work_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, work_order_number text NOT NULL, asset_id uuid REFERENCES assets(id) ON DELETE SET NULL, well_id uuid REFERENCES wells(id) ON DELETE SET NULL, pump_id uuid REFERENCES pumps(id) ON DELETE SET NULL, fault_id uuid REFERENCES faults(id) ON DELETE SET NULL, type text DEFAULT 'corrective', priority text DEFAULT 'medium', status text DEFAULT 'open', description text, assigned_to text, scheduled_date date, completed_date timestamptz, downtime_hours numeric, parts_used text, cost numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE maintenance_work_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_mwo" ON maintenance_work_orders; CREATE POLICY "anon_sel_mwo" ON maintenance_work_orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_mwo" ON maintenance_work_orders; CREATE POLICY "anon_ins_mwo" ON maintenance_work_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_mwo" ON maintenance_work_orders; CREATE POLICY "anon_upd_mwo" ON maintenance_work_orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_mwo" ON maintenance_work_orders; CREATE POLICY "anon_del_mwo" ON maintenance_work_orders FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_mwo_project ON maintenance_work_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_mwo_status ON maintenance_work_orders(status);

CREATE TABLE IF NOT EXISTS field_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE, task_number text NOT NULL, task_type text DEFAULT 'reading', assigned_to text, description text, status text DEFAULT 'assigned', priority text DEFAULT 'medium', due_date date, completed_at timestamptz, items_total int DEFAULT 0, items_completed int DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE field_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_ftasks" ON field_tasks; CREATE POLICY "anon_sel_ftasks" ON field_tasks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_ftasks" ON field_tasks; CREATE POLICY "anon_ins_ftasks" ON field_tasks FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_ftasks" ON field_tasks; CREATE POLICY "anon_upd_ftasks" ON field_tasks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_ftasks" ON field_tasks; CREATE POLICY "anon_del_ftasks" ON field_tasks FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_ftasks_project ON field_tasks(project_id);

CREATE TABLE IF NOT EXISTS notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES projects(id) ON DELETE CASCADE, type text NOT NULL, title_ar text NOT NULL, body_ar text, severity text DEFAULT 'info', is_read boolean DEFAULT false, created_at timestamptz DEFAULT now());
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_notifs" ON notifications; CREATE POLICY "anon_sel_notifs" ON notifications FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_notifs" ON notifications; CREATE POLICY "anon_ins_notifs" ON notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_notifs" ON notifications; CREATE POLICY "anon_upd_notifs" ON notifications FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_notifs" ON notifications; CREATE POLICY "anon_del_notifs" ON notifications FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), table_name text NOT NULL, record_id uuid, action text NOT NULL, old_values jsonb, new_values jsonb, user_id uuid, user_name text, ip_address text, user_agent text, reason text, created_at timestamptz DEFAULT now());
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_audit" ON audit_logs; CREATE POLICY "anon_sel_audit" ON audit_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_audit" ON audit_logs; CREATE POLICY "anon_ins_audit" ON audit_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_audit" ON audit_logs; CREATE POLICY "anon_upd_audit" ON audit_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_audit" ON audit_logs; CREATE POLICY "anon_del_audit" ON audit_logs FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS ai_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation text NOT NULL, model text, prompt_version text, input_summary text, output_summary text, confidence numeric, duration_ms int, success boolean DEFAULT true, error_message text, user_id uuid, created_at timestamptz DEFAULT now());
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_ailogs" ON ai_logs; CREATE POLICY "anon_sel_ailogs" ON ai_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_ailogs" ON ai_logs; CREATE POLICY "anon_ins_ailogs" ON ai_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_ailogs" ON ai_logs; CREATE POLICY "anon_upd_ailogs" ON ai_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_ailogs" ON ai_logs; CREATE POLICY "anon_del_ailogs" ON ai_logs FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS kpi_snapshots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid REFERENCES projects(id) ON DELETE CASCADE, period text NOT NULL, period_start date, period_end date, water_production_m3 numeric, water_consumption_m3 numeric, nrw_percentage numeric, revenue_total numeric, revenue_collected numeric, outstanding_balance numeric, collection_rate numeric, active_customers int, total_readings int, pending_readings int, open_faults int, open_work_orders int, data_completeness numeric, created_at timestamptz DEFAULT now());
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_sel_kpi" ON kpi_snapshots; CREATE POLICY "anon_sel_kpi" ON kpi_snapshots FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_kpi" ON kpi_snapshots; CREATE POLICY "anon_ins_kpi" ON kpi_snapshots FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_kpi" ON kpi_snapshots; CREATE POLICY "anon_upd_kpi" ON kpi_snapshots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_kpi" ON kpi_snapshots; CREATE POLICY "anon_del_kpi" ON kpi_snapshots FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_kpi_project ON kpi_snapshots(project_id);
