select plan(29);

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
    where schemaname='public' and tablename='meters'
      and policyname='sel_meters'
      and coalesce(qual,'') ilike '%get_user_project_id%'
  ),
  'reached meters SELECT policy no longer depends on revoked legacy helper'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='meters'
      and policyname='sel_meters'
      and coalesce(qual,'') ilike '%private.mizan_can_access_project%'
  ),
  'reached meters SELECT policy uses current project authorization kernel'
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


begin;

insert into public.tenants(
  id,parent_tenant_id,name_ar,name_en,tenant_type,timezone,status
) values (
  '11111111-1111-4111-8111-111111111111',
  null,
  'E2E Proof Main',
  'E2E Proof Main',
  'main_tenant',
  'Asia/Aden',
  'active'
)
on conflict (id) do nothing;

insert into public.tenants(
  id,parent_tenant_id,name_ar,name_en,tenant_type,timezone,status
) values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'E2E Proof Subtenant',
  'E2E Proof Subtenant',
  'sub_tenant',
  'Asia/Aden',
  'active'
)
on conflict (id) do nothing;

insert into public.projects(
  id,name_ar,name_en,tenant_id,status
) values (
  '33333333-3333-4333-8333-333333333333',
  'E2E Proof Project',
  'E2E Proof Project',
  '22222222-2222-4222-8222-222222222222',
  'active'
)
on conflict (id) do nothing;

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '44444444-4444-4444-8444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'e2e-blocker-proof@e2e.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles(
  id,email,full_name,role,tenant_id,project_id,must_change_password
) values (
  '44444444-4444-4444-8444-444444444444',
  'e2e-blocker-proof@e2e.invalid',
  'E2E Blocker Proof',
  'central_governance',
  '11111111-1111-4111-8111-111111111111',
  null,
  false
)
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = '44444444-4444-4444-8444-444444444444';

select lives_ok(
  $select public.mizan_operational_report(
      '33333333-3333-4333-8333-333333333333'::uuid,
      date '2026-10-01',
      date '2026-10-03'
    )$,
  'affected authenticated operational-report path executes without get_user_project_id permission error'
);

select is(
  (public.mizan_operational_report(
    '33333333-3333-4333-8333-333333333333'::uuid,
    date '2026-10-01',
    date '2026-10-03'
  )->>'project_id'),
  '33333333-3333-4333-8333-333333333333',
  'affected operational-report path returns the requested project under current authorization'
);

reset role;
rollback;

select * from finish();
