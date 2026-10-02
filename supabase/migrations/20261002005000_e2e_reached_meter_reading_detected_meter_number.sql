-- Root-cause repair for the governed meter-reading identity evidence path.
-- mrx_capture_meter_reading persists the detected physical meter identity
-- supplied by the field/OCR workflow, but the baseline table did not declare
-- the corresponding nullable text column.
alter table public.meter_readings
  add column if not exists ai_detected_meter_number text;
