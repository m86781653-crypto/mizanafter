-- Reconcile remaining legacy role assumptions with the governed role model.

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'viewer';

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(private.mizan_is_platform_admin(), false);
$$;
