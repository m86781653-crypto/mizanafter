-- Remove duplicate indexes introduced by converging the FK index set.
-- Existing equivalent indexes are retained.

drop index if exists public.idx_assets_project_id;
drop index if exists public.idx_audit_logs_actor_user_id;
drop index if exists public.idx_field_tasks_project_id;
drop index if exists public.idx_invoices_customer_id;
drop index if exists public.idx_kpi_snapshots_project_id;
drop index if exists public.idx_work_orders_asset_id;
drop index if exists public.idx_work_orders_fault_id;
drop index if exists public.idx_work_orders_memo_issued_by;
drop index if exists public.idx_work_orders_pump_id;
drop index if exists public.idx_work_orders_well_id;
drop index if exists public.idx_meter_readings_meter_id;
drop index if exists public.idx_payments_invoice_id;
drop index if exists public.idx_projects_organization_id;
drop index if exists public.idx_pumps_project_id;
drop index if exists public.idx_pumps_well_id;
drop index if exists public.idx_tanks_project_id;
drop index if exists public.idx_tariffs_project_id;
drop index if exists public.idx_wells_project_id;

-- The existing select_own_profile policy already includes the own-profile
-- condition plus the elevated administrative visibility. The older policy
-- is strictly redundant for authenticated SELECTs.
drop policy if exists "Users can view own profile" on public.profiles;
