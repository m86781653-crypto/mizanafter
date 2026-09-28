-- Realtime is part of the field/billing consistency contract.
alter publication supabase_realtime add table public.meter_readings, public.invoices, public.payments;
alter table public.meter_readings replica identity full;
alter table public.invoices replica identity full;
alter table public.payments replica identity full;