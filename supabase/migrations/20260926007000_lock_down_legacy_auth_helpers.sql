-- Legacy authorization helpers are not part of the current MIZAN authorization kernel.
-- The auth trigger remains usable by Postgres internally; client roles must not invoke it as an RPC.
revoke execute on function public.get_user_project_id() from public, anon, authenticated;
revoke execute on function public.is_super_admin() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
