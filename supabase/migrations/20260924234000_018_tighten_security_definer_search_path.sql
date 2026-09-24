-- SECURITY DEFINER RPCs use schema-qualified references, so keep the search
-- path empty to prevent object shadowing.
alter function public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid) set search_path = '';
alter function public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) set search_path = '';
alter function public.mizan_record_payment(uuid,numeric,text,text,text) set search_path = '';
