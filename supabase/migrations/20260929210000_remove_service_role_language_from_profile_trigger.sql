create or replace function private.mizan_validate_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
BEGIN
  -- Auth lifecycle triggers may run without an end-user JWT; controlled trigger operations are allowed to complete.
  IF (SELECT auth.uid()) IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'accountant' THEN
    RAISE EXCEPTION 'ROLE_REMOVED';
  END IF;

  IF private.mizan_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF private.mizan_user_role() = 'tenant_manager'
     AND (
       NEW.role IN ('platform_admin','super_admin','tenant_manager','project_manager','accountant')
     ) THEN
    RAISE EXCEPTION 'ROLE_ASSIGNMENT_FORBIDDEN';
  END IF;

  IF private.mizan_user_role() <> 'tenant_manager' THEN
    IF TG_OP = 'INSERT' OR NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'ROLE_ASSIGNMENT_FORBIDDEN';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;