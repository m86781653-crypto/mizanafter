-- Remove obsolete authenticated RPC entry points.
-- Invoices are issued only from the governed meter-reading flow.
-- The legacy five-argument payment RPC is superseded by the idempotent
-- six-argument version.

revoke execute on function public.mizan_create_invoice(uuid,uuid,uuid,date,date)
from public, anon, authenticated;

revoke execute on function public.mizan_record_payment(uuid,numeric,text,text,text)
from public, anon, authenticated;
