-- Root-level security hardening: the permission helper is an internal SECURITY DEFINER function.
-- It must never be exposed as a Data API RPC to anonymous or authenticated clients.
revoke execute on function private.mizan_has_permission(text) from public, anon, authenticated;
