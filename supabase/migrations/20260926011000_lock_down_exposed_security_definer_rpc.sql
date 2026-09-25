-- Keep billing/collection on the control-plane service_role path.
revoke execute on function public.mizan_create_invoice(uuid, uuid, uuid, numeric, date, date) from anon, authenticated;
revoke execute on function public.mizan_record_payment(uuid, numeric, text, text, text) from anon, authenticated;

-- MRX is intentionally callable by authenticated field clients; keep its governed RPC surface.
revoke execute on function public.mrx_capture_meter_reading(uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric, text, text, uuid, text) from anon;
grant execute on function public.mrx_capture_meter_reading(uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric, text, text, uuid, text) to authenticated;

-- PostGIS estimated-extent functions are managed by the extension owner and are handled
-- by the existing PostGIS hardening migrations; do not mutate extension-owned ACLs here.
