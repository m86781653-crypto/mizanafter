-- Root-cause repair for the governed meter-reading business-day checks.
-- mrx_capture_meter_reading derives the Yemen business date from reading_date
-- and uses it for duplicate/service-start validation, but the baseline table
-- did not declare the derived column.
alter table public.meter_readings
  add column if not exists business_date date
  generated always as ((reading_date at time zone 'Asia/Aden')::date) stored;
