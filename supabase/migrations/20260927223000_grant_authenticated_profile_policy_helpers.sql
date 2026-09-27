-- The profiles SELECT policy calls these SECURITY DEFINER helpers.
-- The caller still needs EXECUTE privilege to evaluate the policy.
-- Keep the helpers in private; they only expose the current caller's
-- authorization context and are already protected by SECURITY DEFINER.

grant usage on schema private to authenticated;

grant execute on function private.mizan_user_role() to authenticated;
grant execute on function private.mizan_user_tenant_id() to authenticated;
grant execute on function private.mizan_is_platform_admin() to authenticated;
