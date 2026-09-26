-- Root cleanup: remove the obsolete invoice issuance overload.
-- The production contract is the MRX-bound, authorization-gated signature.
drop function if exists public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date);
