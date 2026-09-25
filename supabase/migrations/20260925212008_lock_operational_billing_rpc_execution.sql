-- Billing and collection RPCs are control-plane operations.
-- They remain SECURITY DEFINER but are not exposed as authenticated REST RPCs.
-- Server-side control-plane code must use the service_role execution path.
revoke execute on function public.mizan_create_invoice(uuid, uuid, uuid, numeric, date, date) from anon, authenticated;
revoke execute on function public.mizan_record_payment(uuid, numeric, text, text, text) from anon, authenticated;
grant execute on function public.mizan_create_invoice(uuid, numeric, uuid, numeric, date, date) to service_role;
grant execute on function public.mizan_record_payment(uuid, numeric, text, text, text) to service_role;
