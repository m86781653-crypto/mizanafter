-- Keep only the production MRX contract that includes server-side meter identity verification.
drop function if exists public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid);
