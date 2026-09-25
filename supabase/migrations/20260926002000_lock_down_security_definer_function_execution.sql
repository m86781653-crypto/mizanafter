-- MIZAN AI — Lock down SECURITY DEFINER RPC execution
-- Security-definer functions are intentionally retained where they cross RLS
-- boundaries, but they must not be callable anonymously or via PUBLIC grants.
-- Application-facing RPCs remain callable by authenticated users because their
-- own authorization checks enforce role/project permissions.

revoke execute on function public.mizan_create_invoice(uuid, uuid, uuid, numeric, date, date) from public, anon;
grant execute on function public.mizan_create_invoice(uuid, uuid, uuid, numeric, date, date) to authenticated;

revoke execute on function public.mizan_create_subtenant(text, text, text) from public, anon;
grant execute on function public.mizan_create_subtenant(text, text, text) to authenticated;

revoke execute on function public.mizan_record_payment(uuid, numeric, text, text, text) from public, anon;
grant execute on function public.mizan_record_payment(uuid, numeric, text, text, text) to authenticated;

revoke execute on function public.mrx_capture_meter_reading(
  uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric,
  text, text, uuid, text
) from public, anon;
grant execute on function public.mrx_capture_meter_reading(
  uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric,
  text, text, uuid, text
) to authenticated;

-- RLS helper functions are private implementation details.
revoke execute on function private.mizan_can_access_project(uuid) from public, anon;
revoke execute on function private.mizan_can_write_project(uuid, text, text) from public, anon;
revoke execute on function private.mizan_is_platform_admin() from public, anon;
revoke execute on function private.mizan_user_role() from public, anon;
revoke execute on function private.mizan_user_tenant_id() from public, anon;
