-- Cover production/maintenance foreign keys used by joins, RLS, audit and reporting.
create index if not exists idx_mwo_closed_by on public.maintenance_work_orders(closed_by);
create index if not exists idx_pump_cycles_production_meter on public.pump_operation_cycles(production_meter_id);
create index if not exists idx_pump_cycles_started_by on public.pump_operation_cycles(started_by);
create index if not exists idx_pump_cycles_stopped_by on public.pump_operation_cycles(stopped_by);
create index if not exists idx_pump_cycles_well on public.pump_operation_cycles(well_id);
create index if not exists idx_service_interruptions_production_meter_fk on public.service_interruptions(production_meter_id);
create index if not exists idx_service_interruptions_restart_reading_fk on public.service_interruptions(restart_reading_id);
create index if not exists idx_service_interruptions_stop_reading_fk on public.service_interruptions(stop_reading_id);
create index if not exists idx_water_production_meters_well on public.water_production_meters(well_id);
create index if not exists idx_water_production_readings_captured_by on public.water_production_readings(captured_by);
create index if not exists idx_water_production_readings_well on public.water_production_readings(well_id);
