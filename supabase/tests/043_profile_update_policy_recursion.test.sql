begin;
select plan(8);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='profiles'
      and policyname='update_own_profile'
      and cmd='UPDATE'
  ),
  'profile update policy exists'
);

select ok(
  (select coalesce(qual,'') || ' ' || coalesce(with_check,'')
   from pg_policies
   where schemaname='public'
     and tablename='profiles'
     and policyname='update_own_profile')
  ~ 'mizan_user_project_id',
  'profile policy uses the project helper'
);

select ok(
  (select coalesce(qual,'') || ' ' || coalesce(with_check,'')
   from pg_policies
   where schemaname='public'
     and tablename='profiles'
     and policyname='update_own_profile')
  ~ 'mizan_user_must_change_password',
  'profile policy uses the password-state helper'
);

select ok(
  (select lower(coalesce(qual,'') || ' ' || coalesce(with_check,''))
   from pg_policies
   where schemaname='public'
     and tablename='profiles'
     and policyname='update_own_profile')
  !~ 'from[[:space:]]+public\.profiles'
  and
  (select lower(coalesce(qual,'') || ' ' || coalesce(with_check,''))
   from pg_policies
   where schemaname='public'
     and tablename='profiles'
     and policyname='update_own_profile')
  !~ 'from[[:space:]]+profiles',
  'profile policy no longer self-queries profiles and cannot recurse'
);

select ok(
  (select p.prosecdef and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=%'
   from pg_proc p
   where p.oid='private.mizan_user_project_id()'::regprocedure)
  and
  (select p.prosecdef and coalesce(array_to_string(p.proconfig,','),'') like '%search_path=%'
   from pg_proc p
   where p.oid='private.mizan_user_must_change_password()'::regprocedure),
  'profile helpers are SECURITY DEFINER with controlled search_path'
);

select ok(
  has_function_privilege('authenticated','private.mizan_clear_must_change_password(uuid)','EXECUTE'),
  'authenticated retains governed password completion helper access'
);

select ok(
  (select pg_get_functiondef('public.mizan_complete_password_change()'::regprocedure))
  ~ 'private\.mizan_clear_must_change_password',
  'password completion RPC delegates to governed helper'
);

select ok(
  has_function_privilege('authenticated','private.mizan_user_project_id()','EXECUTE')
  and has_function_privilege('authenticated','private.mizan_user_must_change_password()','EXECUTE')
  and not has_function_privilege('anon','private.mizan_user_project_id()','EXECUTE')
  and not has_function_privilege('anon','private.mizan_user_must_change_password()','EXECUTE'),
  'profile-state helpers are authenticated-only'
);

select * from finish();
rollback;
