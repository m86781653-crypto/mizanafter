begin;
select plan(3);

select ok(
  (select pg_get_expr(p.polwithcheck, p.polrelid) from pg_policy p
   join pg_class c on c.oid=p.polrelid
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='profiles' and p.polname='update_own_profile')
  ~ 'must_change_password',
  'profile update policy protects must_change_password'
);

select ok(
  (select pg_get_functiondef('public.mizan_complete_password_change()'::regprocedure))
  ~ 'private\.mizan_clear_must_change_password',
  'governed password completion updates password state'
);

select ok(
  (select p.prosecdef from pg_proc p where p.oid='private.mizan_clear_must_change_password(uuid)'::regprocedure),
  'password state helper is SECURITY DEFINER'
);

select * from finish();
rollback;
