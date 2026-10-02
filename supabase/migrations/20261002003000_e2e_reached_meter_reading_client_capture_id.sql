-- Root-cause repair for the governed meter-reading capture path.
-- The production UI and mrx_capture_meter_reading use client_capture_id as
-- the client-generated idempotency/evidence key, but the baseline table
-- schema did not declare the corresponding column.
alter table public.meter_readings
  add column if not exists client_capture_id uuid;
