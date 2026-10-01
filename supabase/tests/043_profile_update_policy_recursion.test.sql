begin;
select plan(7);

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
values('00000000-0000-4000-8000-000000000104','authenticated','authenticated','mizan-profile-policy@test.invalid',now(),now(),now());

insert into public.profiles(id,email,full_name,role,tenant_id,must_change_password)
values(
  '00000000-0000-4000-8000-000000000104',
  'mizan-profile-policy@test.invalid',
  'Profile Policy Contract',
  'meter_reader',
  (select id from public.tenants where tenant_type='main_tenant' and status='active' limit 1),
  true
);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000104',true);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='profiles'
      and policyname='update_own_profile'
      and (
        coalesce(qual,'') ilike '%from profiles%'
        or coalesce(with_check,'') ilike '%from profiles%'
      )
  ),
  'profile update policy does not self-query public.profiles'
);

update public.profiles
set full_name='Updated Name'
where id=(select auth.uid());

select is(
  (select full_name from public.profiles where id=(select auth.uid())),
  'Updated Name',
  'ordinary own-profile update succeeds without policy recursion'
);

select ok(
  private.mizan_user_project_id() is null,
  'project helper resolves current project safely for project-less profile'
);

select ok(
  private.mizan_user_must_change_password() is true,
  'password-state helper resolves current value safely'
);

select ok(
  has_function_privilege('authenticated','private.mizan_clear_must_change_password(uuid)','EXECUTE'),
  'authenticated can execute the governed password-state helper'
);

do $$
declare
  v_denied boolean := false;
begin
  begin
    update public.profiles
       set must_change_password=false
     where id=(select auth.uid());
  exception when others then
    v_denied := (sqlstate = '42501');
    if not v_denied then
      raise;
    end if;
  end;
  if not v_denied then
    raise exception 'DIRECT_PASSWORD_STATE_UPDATE_UNEXPECTEDLY_ALLOWED';
  end if;
end $$;

select ok(true, 'direct password-state mutation is denied by profile policy');

select public.mizan_complete_password_change();

select is(
  (select must_change_password from public.profiles where id=(select auth.uid())),
  false,
  'governed password completion still succeeds'
);

select * from finish();
rollback;
