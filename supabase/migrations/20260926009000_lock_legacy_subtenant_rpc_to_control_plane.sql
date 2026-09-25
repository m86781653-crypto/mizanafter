-- Lock the legacy subtenant RPC behind the control plane.
-- Subtenant provisioning must use the audited provision-subtenant Edge Function,
-- which creates the child tenant, project, and exactly three operational accounts atomically.
REVOKE EXECUTE ON FUNCTION public.mizan_create_subtenant(text, text, text) FROM PUBLIC, anon, authenticated;
