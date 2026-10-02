-- Root-cause repair for PostgREST function overload ambiguity.
-- The legacy five-argument payment RPC is superseded by the idempotent
-- six-argument function used by the current application.
drop function if exists public.mizan_record_payment(uuid,numeric,text,text,text);
