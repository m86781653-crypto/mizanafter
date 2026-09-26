-- Remove client EXECUTE access from private trigger/guard helpers.
-- These functions are invoked by database triggers, not directly by clients.
REVOKE EXECUTE ON FUNCTION private.mizan_block_audit_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.mizan_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.mizan_validate_profile_role_change() FROM PUBLIC, anon, authenticated;
