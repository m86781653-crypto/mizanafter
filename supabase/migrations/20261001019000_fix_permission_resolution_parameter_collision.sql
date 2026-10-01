-- Root-cause authorization fix:
-- The permission helper previously compared rp.permission_code to an identically
-- named SQL parameter, which PostgreSQL resolves to the column in this context.
-- That made the predicate effectively rp.permission_code = rp.permission_code,
-- allowing any role with at least one permission to satisfy arbitrary checks.
-- Preserve the public function signature while using positional parameter $1.
create or replace function private.mizan_has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
select coalesce(exists(
  select 1
  from public.mizan_role_permissions rp
  where rp.role_code = private.mizan_user_role()
    and rp.permission_code = $1
),false)
$function$;
