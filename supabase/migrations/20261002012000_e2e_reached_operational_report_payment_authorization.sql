-- E2E-reached authorization repair.
-- The affected SECURITY INVOKER operational report reaches payments after
-- customers/meters/invoices. The legacy payments SELECT policy still called
-- public.get_user_project_id(), whose client EXECUTE privilege is intentionally
-- revoked. Preserve project scoping through the current authorization kernel.
drop policy if exists sel_payments on public.payments;
create policy sel_payments on public.payments
for select to authenticated
using (private.mizan_is_platform_admin() or private.mizan_can_access_project(project_id));
