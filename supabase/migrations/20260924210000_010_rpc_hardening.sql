/*
# MIZAN — RPC hardening
Adds explicit execute grants/revokes and prevents public execution of production
water-service RPCs. No new business objects.
*/

REVOKE ALL ON FUNCTION public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) TO authenticated;

REVOKE ALL ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text) TO authenticated;

COMMENT ON FUNCTION public.mrx_capture_meter_reading IS
  'Production MRX boundary: authenticated callers only; authorization and validation remain server-side.';
