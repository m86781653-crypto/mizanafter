-- Internal auth helper functions are used by RLS/policy logic and must not be
-- exposed as public RPC endpoints.
revoke execute on function public.get_user_project_id() from anon, authenticated;
revoke execute on function public.get_user_tenant_id() from anon, authenticated;
revoke execute on function public.is_main_tenant_user() from anon, authenticated;
revoke execute on function public.is_super_admin() from anon, authenticated;
revoke execute on function public.is_tenant_manager() from anon, authenticated;
