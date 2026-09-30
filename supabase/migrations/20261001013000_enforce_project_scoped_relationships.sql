-- Enforce project isolation at the relational boundary.
-- Every nullable relationship below is already scoped by project_id in the application model.
-- These composite foreign keys prevent a valid UUID from another project from being attached to a row in this project.

create unique index if not exists uq_customers_project_id_id on public.customers(project_id,id);
create unique index if not exists uq_meters_project_id_id on public.meters(project_id,id);
create unique index if not exists uq_wells_project_id_id on public.wells(project_id,id);
create unique index if not exists uq_pumps_project_id_id on public.pumps(project_id,id);
create unique index if not exists uq_assets_project_id_id on public.assets(project_id,id);
create unique index if not exists uq_tariffs_project_id_id on public.tariffs(project_id,id);
create unique index if not exists uq_faults_project_id_id on public.faults(project_id,id);
create unique index if not exists uq_service_interruptions_project_id_id on public.service_interruptions(project_id,id);
create unique index if not exists uq_water_production_meters_project_id_id on public.water_production_meters(project_id,id);
create unique index if not exists uq_water_production_readings_project_id_id on public.water_production_readings(project_id,id);
create unique index if not exists uq_invoices_project_id_id on public.invoices(project_id,id);

alter table public.meters add constraint fk_meters_project_customer
  foreign key (project_id,customer_id) references public.customers(project_id,id);

alter table public.pumps add constraint fk_pumps_project_well
  foreign key (project_id,well_id) references public.wells(project_id,id);

alter table public.water_production_meters add constraint fk_wpm_project_well
  foreign key (project_id,well_id) references public.wells(project_id,id);
alter table public.water_production_meters add constraint fk_wpm_project_pump
  foreign key (project_id,pump_id) references public.pumps(project_id,id);

alter table public.faults add constraint fk_faults_project_asset
  foreign key (project_id,asset_id) references public.assets(project_id,id);
alter table public.faults add constraint fk_faults_project_well
  foreign key (project_id,well_id) references public.wells(project_id,id);
alter table public.faults add constraint fk_faults_project_pump
  foreign key (project_id,pump_id) references public.pumps(project_id,id);
alter table public.faults add constraint fk_faults_project_interruption
  foreign key (project_id,interruption_id) references public.service_interruptions(project_id,id);

alter table public.meter_readings add constraint fk_meter_readings_project_customer
  foreign key (project_id,customer_id) references public.customers(project_id,id);
alter table public.meter_readings add constraint fk_meter_readings_project_meter
  foreign key (project_id,meter_id) references public.meters(project_id,id);

alter table public.invoices add constraint fk_invoices_project_customer
  foreign key (project_id,customer_id) references public.customers(project_id,id);
alter table public.invoices add constraint fk_invoices_project_meter
  foreign key (project_id,meter_id) references public.meters(project_id,id);
alter table public.invoices add constraint fk_invoices_project_tariff
  foreign key (project_id,tariff_id) references public.tariffs(project_id,id);
-- source_reading_id points to a subscriber meter reading; enforce project parity.
alter table public.invoices add constraint fk_invoices_project_source_reading
  foreign key (project_id,source_reading_id) references public.meter_readings(project_id,id);

alter table public.payments add constraint fk_payments_project_customer
  foreign key (project_id,customer_id) references public.customers(project_id,id);
alter table public.payments add constraint fk_payments_project_invoice
  foreign key (project_id,invoice_id) references public.invoices(project_id,id);

alter table public.maintenance_work_orders add constraint fk_work_orders_project_asset
  foreign key (project_id,asset_id) references public.assets(project_id,id);
alter table public.maintenance_work_orders add constraint fk_work_orders_project_fault
  foreign key (project_id,fault_id) references public.faults(project_id,id);
alter table public.maintenance_work_orders add constraint fk_work_orders_project_well
  foreign key (project_id,well_id) references public.wells(project_id,id);
alter table public.maintenance_work_orders add constraint fk_work_orders_project_pump
  foreign key (project_id,pump_id) references public.pumps(project_id,id);

alter table public.service_interruptions add constraint fk_interruptions_project_fault
  foreign key (project_id,fault_id) references public.faults(project_id,id);
alter table public.service_interruptions add constraint fk_interruptions_project_production_meter
  foreign key (project_id,production_meter_id) references public.water_production_meters(project_id,id);
alter table public.service_interruptions add constraint fk_interruptions_project_stop_reading
  foreign key (project_id,stop_reading_id) references public.water_production_readings(project_id,id);
alter table public.service_interruptions add constraint fk_interruptions_project_restart_reading
  foreign key (project_id,restart_reading_id) references public.water_production_readings(project_id,id);

alter table public.pump_operation_cycles add constraint fk_cycles_project_well
  foreign key (project_id,well_id) references public.wells(project_id,id);
alter table public.pump_operation_cycles add constraint fk_cycles_project_pump
  foreign key (project_id,pump_id) references public.pumps(project_id,id);
alter table public.pump_operation_cycles add constraint fk_cycles_project_production_meter
  foreign key (project_id,production_meter_id) references public.water_production_meters(project_id,id);
alter table public.pump_operation_cycles add constraint fk_cycles_project_start_reading
  foreign key (project_id,start_reading_id) references public.water_production_readings(project_id,id);
alter table public.pump_operation_cycles add constraint fk_cycles_project_stop_reading
  foreign key (project_id,stop_reading_id) references public.water_production_readings(project_id,id);

alter table public.water_production_readings add constraint fk_wpr_project_production_meter
  foreign key (project_id,production_meter_id) references public.water_production_meters(project_id,id);
alter table public.water_production_readings add constraint fk_wpr_project_well
  foreign key (project_id,well_id) references public.wells(project_id,id);
alter table public.water_production_readings add constraint fk_wpr_project_pump
  foreign key (project_id,pump_id) references public.pumps(project_id,id);
