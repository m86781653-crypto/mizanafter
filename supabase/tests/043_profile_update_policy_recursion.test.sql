begin;
select plan(6);

insert into public.tenants(id,name_ar,tenant_type,status,parent_tenant_id)
values('00000000-0000-4000-8000-000000000204','Profile Policy Contract Tenant','sub_tenant','active','b9295364-d688-4e20-b2a3-433f08bfdcaa');

insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
values('00000000-0000-4000-8000-000000000104','authenticated','authenticated','mizan-profile-policy@test.invalid',now(),now(),now());

insert into public.profiles(id,email,full_name,role,tenant_id,must_change_password)
values('00000000-0000-4000-8000-000000000104','mizan-profile-policy@test.invalid','Profile Policy Contract','meter_reader','00000000-0000-4000-8000-000000000204',true);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000104',true);

update public.profiles set full_name='Updated Name' where id=(select auth.uid());
select is((select full_name from public.profiles where id=(select auth.uid())),'Updated Name','ordinary own-profile update succeeds without policy recursion');

do $$
begin
  begin
    update public.profiles set must_change_password=false where id=(select auth.uid());
    raise exception 'DIRECT_PASSWORD_STATE_UPDATE_UNEXPECTEDLY_ALLOWED';
  exception when others then
    if sqlstate <> '42501' then raise; end if;
  end;
end $$;
select pass('direct password-state mutation is denied by policy');

select is(private.mizan_user_project_id(),null::uuid,'project helper resolves current profile safely');
select is(private.mizan_user_must_change_password(),true,'password-state helper resolves current value safely');
select is(has_function_privilege('authenticated','private.mizan_clear_must_change_password(uuid)','EXECUTE'),true,'authenticated can call only the governed password-state helper');

select public.mizan_complete_password_change();
select is((select must_change_password from public.profiles where id=(select auth.uid())),false,'governed password completion still succeeds');

select * from finish();
rollback;
