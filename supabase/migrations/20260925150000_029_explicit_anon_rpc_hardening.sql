/* MIZAN — explicit anonymous RPC hardening
 *
 * Some local/managed Postgres role layouts can retain an explicit anon
 * function grant even after PUBLIC is revoked. Sensitive state-changing
 * RPCs therefore revoke both PUBLIC and anon explicitly.
 *
 * Authenticated execution remains intentional; each RPC performs its own
 * server-side authentication, permission and project-scope checks.
 */

REVOKE ALL ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date)
TO authenticated;

REVOKE ALL ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text)
TO authenticated;

REVOKE ALL ON FUNCTION public.mrx_capture_meter_reading(
  uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text
)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mrx_capture_meter_reading(
  uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text
)
TO authenticated;
