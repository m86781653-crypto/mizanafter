begin;
select plan(4);

select ok((select count(*) from pg_constraint where conname in (
  'fk_meters_project_customer',
  'fk_pumps_project_well',
  'fk_wpm_project_well','fk_wpm_project_pump',
  'fk_faults_project_asset','fk_faults_project_well','fk_faults_project_pump','fk_faults_project_interruption',
  'fk_meter_readings_project_customer','fk_meter_readings_project_meter',
  'fk_invoices_project_customer','fk_invoices_project_meter','fk_invoices_project_tariff','fk_invoices_project_source_reading',
  'fk_payments_project_customer','fk_payments_project_invoice',
  'fk_work_orders_project_asset','fk_work_orders_project_fault','fk_work_orders_project_well','fk_work_orders_project_pump',
  'fk_interruptions_project_fault','fk_interruptions_project_production_meter','fk_interruptions_project_stop_reading','fk_interruptions_project_restart_reading',
  'fk_cycles_project_well','fk_cycles_project_pump','fk_cycles_project_production_meter','fk_cycles_project_start_reading'
)) = 27, 'project-scoped relationship constraints exist');

select ok((select count(*) from pg_constraint where conname='fk_cycles_project_stop_reading')=1,'cycle stop reading scope constraint exists');
select ok((select count(*) from pg_constraint where conname like 'fk_wpr_project_%')=3,'all production-reading project scope constraints exist');
select ok((select count(*) from pg_class c where c.relname in (
  'uq_customers_project_id_id','uq_meters_project_id_id','uq_wells_project_id_id','uq_pumps_project_id_id',
  'uq_assets_project_id_id','uq_tariffs_project_id_id','uq_faults_project_id_id',
  'uq_service_interruptions_project_id_id','uq_water_production_meters_project_id_id',
  'uq_water_production_readings_project_id_id','uq_invoices_project_id_id'
))=11,'composite parent uniqueness indexes exist');
select * from finish();
rollback;