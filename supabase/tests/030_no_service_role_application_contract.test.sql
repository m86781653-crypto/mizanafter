begin;

select plan(7);

select is(
  count(*)::integer,
  0,
  'legacy service-role provisioning RPC is removed'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and p.proname = 'mizan_provision_subtenant_auto';

select is(
  count(*)::integer,
  0,
  'public/private application functions do not reference service_role'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private')
  and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ilike '%service_role%';

select is(
  has_function_privilege('authenticated', 'public.mizan_list_project_users(uuid)', 'EXECUTE'),
  true,
  'authenticated can execute scoped project-user listing RPC'
);

select is(
  has_function_privilege('anon', 'public.mizan_list_project_users(uuid)', 'EXECUTE'),
  false,
  'anon cannot execute scoped project-user listing RPC'
);

select is(
  has_function_privilege('authenticated', 'public.mizan_manage_project_user_profile(uuid,text,text,boolean)', 'EXECUTE'),
  true,
  'authenticated can execute scoped project-user profile management RPC'
);

select is(
  has_function_privilege('anon', 'public.mizan_manage_project_user_profile(uuid,text,text,boolean)', 'EXECUTE'),
  false,
  'anon cannot execute scoped project-user profile management RPC'
);

select is(
  has_function_privilege('authenticated', 'public.mizan_provision_subtenant(text,text,text,text,text,text,numeric,text,text,integer,numeric,numeric,text,date,uuid,jsonb)', 'EXECUTE'),
  true,
  'authenticated central governance uses the RLS-guarded provisioning RPC'
);

select * from finish();
rollback;