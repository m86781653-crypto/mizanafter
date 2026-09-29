-- Final cleanup: the legacy auto-provisioning RPC was historically recreated by
-- a later migration than its first removal. Remove it after the complete migration chain.
drop function if exists public.mizan_provision_subtenant_auto(
  uuid,text,text,text,text,text,text,numeric,text,text,integer,numeric,numeric,text,date,uuid,jsonb
);
