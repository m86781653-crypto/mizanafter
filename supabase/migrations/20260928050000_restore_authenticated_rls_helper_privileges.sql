-- Restore only the private authorization-helper privileges required by RLS evaluation.
-- The private schema remains non-API, and helper functions remain SECURITY DEFINER.
-- authenticated needs schema USAGE + EXECUTE because public RLS policies invoke these helpers.

grant usage on schema private to authenticated;

grant execute on function private.mizan_user_tenant_id() to authenticated;
grant execute on function private.mizan_user_role() to authenticated;
grant execute on function private.mizan_is_platform_admin() to authenticated;
grant execute on function private.mizan_has_permission(text) to authenticated;
grant execute on function private.mizan_can_access_project(uuid) to authenticated;
grant execute on function private.mizan_can_write_project(uuid,text,text) to authenticated;
