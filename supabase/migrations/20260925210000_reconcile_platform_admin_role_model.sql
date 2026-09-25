-- Reconcile remaining legacy role assumptions with the governed role model.

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'viewer';

-- The governed private authorization kernel is bootstrapped later, after tenant governance.
-- is_super_admin is recreated there so this migration remains valid on a clean database.
