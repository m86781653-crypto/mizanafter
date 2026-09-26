create or replace function private.mizan_user_role()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
select case
  when p.role='super_admin' then 'platform_admin'
  when p.role='collector' then 'collection_officer'
  when p.role='maintenance_tech' then 'technician'
  when p.role='read_only' then 'viewer'
  else p.role
end
from public.profiles p
where p.id=(select auth.uid())
$function$;
