-- Root-level privilege minimization. RLS controls row access; these capabilities are not needed by application clients.
revoke truncate, trigger, references on table public.faults, public.invoices, public.meter_readings, public.payments, public.service_interruptions from authenticated, anon;
revoke truncate, trigger, references on table public.profiles, public.projects, public.tenants from authenticated, anon;
