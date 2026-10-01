select plan(25);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='projects'
      and policyname='sel_projects'
      and coalesce(qual,'') ilike '%get_user_project_id%'
  ),
  'projects SELECT policy no longer depends on revoked legacy helper'
);

select ok(
  not has_function_privilege('authenticated','public.get_user_project_id()','execute'),
  'legacy get_user_project_id remains inaccessible to authenticated clients'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='projects'
      and policyname='sel_projects'
      and coalesce(qual,'') ilike '%private.mizan_can_access_project%'
      and coalesce(qual,'') ilike '%central_governance%'
  ),
  'projects SELECT policy uses current kernel and central governance scope'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wells'
      and policyname='sel_wells'
      and coalesce(qual,'') ilike '%get_user_project_id%'
  ),
  'reached wells SELECT policy no longer depends on revoked legacy helper'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wells'
      and policyname='sel_wells'
      and coalesce(qual,'') ilike '%private.mizan_can_access_project%'
  ),
  'reached wells SELECT policy uses current project authorization kernel'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pumps'
      and policyname='sel_pumps'
      and coalesce(qual,'') ilike '%get_user_project_id%'
  ),
  'reached pumps SELECT policy no longer depends on revoked legacy helper'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pumps'
      and policyname='sel_pumps'
      and coalesce(qual,'') ilike '%private.mizan_can_access_project%'
  ),
  'reached pumps SELECT policy uses current project authorization kernel'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tanks'
      and policyname='sel_tanks'
      and coalesce(qual,'') ilike '%get_user_project_id%'
  ),
  'reached tanks SELECT policy no longer depends on revoked legacy helper'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tanks'
      and policyname='sel_tanks'
      and coalesce(qual,'') ilike '%private.mizan_can_access_project%'
  ),
  'reached tanks SELECT policy uses current project authorization kernel'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='customers'
      and policyname='sel_customers'
      and coalesce(qual,'') ilike '%get_user_project_id%'
  ),
  'reached customers SELECT policy no longer depends on revoked legacy helper'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='customers'
      and policyname='sel_customers'
      and coalesce(qual,'') ilike '%private.mizan_can_access_project%'
  ),
  'reached customers SELECT policy uses current project authorization kernel'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wells'
      and policyname='ins_wells'
      and coalesce(with_check,'') ilike '%is_super_admin%'
  ),
  'reached wells INSERT policy no longer depends on revoked legacy helper'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='wells'
      and policyname='ins_wells'
      and coalesce(with_check,'') ilike '%private.mizan_can_write_project%'
  ),
  'reached wells INSERT policy uses current write authorization kernel'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pumps'
      and policyname='ins_pumps'
      and coalesce(with_check,'') ilike '%is_super_admin%'
  ),
  'reached pumps INSERT policy no longer depends on revoked legacy helper'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='pumps'
      and policyname='ins_pumps'
      and coalesce(with_check,'') ilike '%private.mizan_can_write_project%'
  ),
  'reached pumps INSERT policy uses current write authorization kernel'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tanks'
      and policyname='ins_tanks'
      and coalesce(with_check,'') ilike '%is_super_admin%'
  ),
  'reached tanks INSERT policy no longer depends on retired super-admin helper'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tanks'
      and policyname='ins_tanks'
      and coalesce(with_check,'') ilike '%private.mizan_can_write_project%'
  ),
  'reached tanks INSERT policy uses current project write authorization kernel'
);

select ok(
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='handle_new_user'
  ),
  'auth profile trigger function exists'
);

select ok(
  coalesce((
    select pg_get_functiondef(p.oid) ilike '%raw_user_meta_data%'
       and not pg_get_functiondef(p.oid) ilike '%raw_app_meta_data->>''onboarding_token''%'
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='handle_new_user'
    limit 1
  ),false),
  'onboarding trigger reads the metadata field written by signUp'
);

select ok(
  not has_function_privilege('authenticated','public.handle_new_user()','execute'),
  'profile trigger remains unavailable as a client RPC'
);

select ok(
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth'
      and c.relname='users'
      and t.tgname='on_auth_user_created'
  ),
  'auth.users onboarding trigger remains attached'
);

select ok(
  not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_role_allowed_chk'
  ),
  'stale duplicate profile role constraint removed'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_role_check'
      and pg_get_constraintdef(oid) ilike '%operations_maintenance%'
  ),
  'canonical profile role constraint accepts operations_maintenance'
);

select ok(
  exists (
    select 1 from public.mizan_role_catalog
    where role_code='operations_maintenance' and is_legacy=false
  ),
  'operations_maintenance remains canonical in the role catalog'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid='private.subtenant_user_slots'::regclass
      and conname='subtenant_user_slots_role_check'
      and pg_get_constraintdef(oid) ilike '%operations_maintenance%'
  ),
  'subtenant onboarding slots accept the same fourth role'
);

select * from finish();
