-- Production FK indexes for tenant/project-scale growth.
-- These indexes support RLS joins, tenant filtering, invoice/payment lineage,
-- maintenance relations, and cascade/delete checks.

create index if not exists idx_districts_region_id on public.districts(region_id);
create index if not exists idx_projects_district_id on public.projects(district_id);
create index if not exists idx_projects_organization_id on public.projects(organization_id);

create index if not exists idx_wells_project_id on public.wells(project_id);
create index if not exists idx_pumps_project_id on public.pumps(project_id);
create index if not exists idx_pumps_well_id on public.pumps(well_id);
create index if not exists idx_tanks_project_id on public.tanks(project_id);

create index if not exists idx_customers_project_id on public.customers(project_id);
create index if not exists idx_meters_project_id on public.meters(project_id);
create index if not exists idx_meter_readings_customer_id on public.meter_readings(customer_id);
create index if not exists idx_meter_readings_meter_id on public.meter_readings(meter_id);
create index if not exists idx_meter_readings_project_id on public.meter_readings(project_id);

create index if not exists idx_tariffs_project_id on public.tariffs(project_id);
create index if not exists idx_tariff_tiers_tariff_id on public.tariff_tiers(tariff_id);

create index if not exists idx_invoices_customer_id on public.invoices(customer_id);
create index if not exists idx_invoices_meter_id on public.invoices(meter_id);
create index if not exists idx_invoices_project_id on public.invoices(project_id);
create index if not exists idx_invoices_source_reading_id on public.invoices(source_reading_id);
create index if not exists idx_invoices_tariff_id on public.invoices(tariff_id);

create index if not exists idx_payments_approved_by on public.payments(approved_by);
create index if not exists idx_payments_customer_id on public.payments(customer_id);
create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_payments_project_id on public.payments(project_id);
create index if not exists idx_payments_recorded_by on public.payments(recorded_by);
create index if not exists idx_payments_rejected_by on public.payments(rejected_by);

create index if not exists idx_assets_project_id on public.assets(project_id);
create index if not exists idx_faults_asset_id on public.faults(asset_id);
create index if not exists idx_faults_project_id on public.faults(project_id);
create index if not exists idx_faults_pump_id on public.faults(pump_id);
create index if not exists idx_faults_well_id on public.faults(well_id);

create index if not exists idx_work_orders_asset_id on public.maintenance_work_orders(asset_id);
create index if not exists idx_work_orders_fault_id on public.maintenance_work_orders(fault_id);
create index if not exists idx_work_orders_memo_issued_by on public.maintenance_work_orders(memo_issued_by);
create index if not exists idx_work_orders_project_id on public.maintenance_work_orders(project_id);
create index if not exists idx_work_orders_pump_id on public.maintenance_work_orders(pump_id);
create index if not exists idx_work_orders_well_id on public.maintenance_work_orders(well_id);

create index if not exists idx_field_tasks_project_id on public.field_tasks(project_id);
create index if not exists idx_notifications_project_id on public.notifications(project_id);
create index if not exists idx_audit_logs_actor_user_id on public.audit_logs(actor_user_id);
create index if not exists idx_audit_logs_project_id on public.audit_logs(project_id);
create index if not exists idx_ai_logs_project_id on public.ai_logs(project_id);
create index if not exists idx_kpi_snapshots_project_id on public.kpi_snapshots(project_id);
create index if not exists idx_profiles_project_id on public.profiles(project_id);
create index if not exists idx_profiles_tenant_id on public.profiles(tenant_id);
create index if not exists idx_project_seq_counters_project_id on public.project_seq_counters(project_id);
create index if not exists idx_tenants_parent_tenant_id on public.tenants(parent_tenant_id);
create index if not exists idx_service_interruptions_project_id on public.service_interruptions(project_id);
create index if not exists idx_service_interruptions_reported_by on public.service_interruptions(reported_by);
create index if not exists idx_service_interruptions_verified_by on public.service_interruptions(verified_by);
