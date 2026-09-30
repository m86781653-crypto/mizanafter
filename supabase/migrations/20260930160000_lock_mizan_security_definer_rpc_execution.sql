-- Lock public MIZAN SECURITY DEFINER RPC execution for the water-production and provisioning paths.
-- These functions are authenticated application APIs; anonymous execution is never valid.

revoke all on function public.mizan_capture_water_production_reading(
  uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text
) from public, anon, authenticated;
grant execute on function public.mizan_capture_water_production_reading(
  uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,text
) to authenticated;

revoke all on function public.mizan_register_water_production_meter(
  uuid,uuid,uuid,text,text,numeric,date,text
) from public, anon, authenticated;
grant execute on function public.mizan_register_water_production_meter(
  uuid,uuid,uuid,text,text,numeric,date,text
) to authenticated;

revoke all on function public.mizan_start_pump_operation_cycle(
  uuid,uuid,timestamptz,text
) from public, anon, authenticated;
grant execute on function public.mizan_start_pump_operation_cycle(
  uuid,uuid,timestamptz,text
) to authenticated;

revoke all on function public.mizan_stop_pump_operation_cycle(
  uuid,uuid,timestamptz,text
) from public, anon, authenticated;
grant execute on function public.mizan_stop_pump_operation_cycle(
  uuid,uuid,timestamptz,text
) to authenticated;

revoke all on function public.mizan_provision_subtenant(
  text,text,text,text,text,text,numeric,text,text,integer,numeric,numeric,text,date,uuid,jsonb
) from public, anon, authenticated;
grant execute on function public.mizan_provision_subtenant(
  text,text,text,text,text,text,numeric,text,text,integer,numeric,numeric,text,date,uuid,jsonb
) to authenticated;

-- Prevent the same class of regression for future postgres-owned public functions.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
