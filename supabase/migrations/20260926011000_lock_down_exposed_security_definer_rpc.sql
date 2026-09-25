-- Keep billing/collection on the control-plane service_role path.
revoke execute on function public.mizan_create_invoice(uuid, uuid, uuid, numeric, date, date) from anon, authenticated;
revoke execute on function public.mizan_record_payment(uuid, numeric, text, text, text) from anon, authenticated;

-- MRX is intentionally callable by authenticated field clients; keep its governed RPC surface.
revoke execute on function public.mrx_capture_meter_reading(uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric, text, text, uuid, text) from anon;
grant execute on function public.mrx_capture_meter_reading(uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric, text, text, uuid, text) to authenticated;

-- PostGIS estimated-extent helpers are not part of MIZAN's public RPC surface.
revoke execute on function public.st_estimatedextent(text,text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text) from public, anon, authenticated;
revoke execute on function public.st_estimatedextent(text,text,text,boolean) from public, anon, authenticated;
