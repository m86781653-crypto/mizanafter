begin;
select plan(6);

-- Deterministic fixtures, fully rolled back at the end of the test.
insert into public.tenants (id,name_ar,name_en,tenant_type,status,parent_tenant_id)
values
 ('00000000-0000-4000-8000-000000000301','Lifecycle Main A','Lifecycle Main A','main_tenant','active',null),
 ('00000000-0000-4000-8000-000000000302','Lifecycle Sub A','Lifecycle Sub A','sub_tenant','active','00000000-0000-4000-8000-000000000301'),
 ('00000000-0000-4000-8000-000000000303','Lifecycle Main B','Lifecycle Main B','main_tenant','active',null),
 ('00000000-0000-4000-8000-000000000304','Lifecycle Sub B Archived','Lifecycle Sub B Archived','sub_tenant','archived','00000000-0000-4000-8000-000000000303');

insert into public.projects (id,name_ar,tenant_id,status)
values
 ('00000000-0000-4000-8000-000000000311','Lifecycle active project A','00000000-0000-4000-8000-000000000302','active'),
 ('00000000-0000-4000-8000-000000000312','Lifecycle archived project A','00000000-0000-4000-8000-000000000302','archived'),
 ('00000000-0000-4000-8000-000000000313','Lifecycle active project B','00000000-0000-4000-8000-000000000304','active');

insert into auth.users (id,aud,role,email,email_confirmed_at,created_at,updated_at,raw_user_meta_data)
values
 ('00000000-0000-4000-8000-000000000321','authenticated','authenticated','lifecycle-sub-a@test.invalid',now(),now(),now(),'{}'::jsonb),
 ('00000000-0000-4000-8000-000000000322','authenticated','authenticated','lifecycle-main-a@test.invalid',now(),now(),now(),'{}'::jsonb),
 ('00000000-0000-4000-8000-000000000323','authenticated','authenticated','lifecycle-archived-sub-b@test.invalid',now(),now(),now(),'{}'::jsonb),
 ('00000000-0000-4000-8000-000000000324','authenticated','authenticated','lifecycle-platform-admin@test.invalid',now(),now(),now(),'{}'::jsonb);

insert into public.profiles (id,email,full_name,role,must_change_password,tenant_id)
values
 ('00000000-0000-4000-8000-000000000321','lifecycle-sub-a@test.invalid','Lifecycle Sub A User','project_manager',false,'00000000-0000-4000-8000-000000000302'),
 ('00000000-0000-4000-8000-000000000322','lifecycle-main-a@test.invalid','Lifecycle Main A User','project_manager',false,'00000000-0000-4000-8000-000000000301'),
 ('00000000-0000-4000-8000-000000000323','lifecycle-archived-sub-b@test.invalid','Lifecycle Archived Sub B User','project_manager',false,'00000000-0000-4000-8000-000000000304'),
 ('00000000-0000-4000-8000-000000000324','lifecycle-platform-admin@test.invalid','Lifecycle Platform Admin','super_admin',false,null);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000321',true);
select is(private.mizan_can_access_project('00000000-0000-4000-8000-000000000311'),true,
  'active subtenant user can access own active project');
select is(private.mizan_can_access_project('00000000-0000-4000-8000-000000000312'),false,
  'active subtenant user cannot access archived project');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000322',true);
select is(private.mizan_can_access_project('00000000-0000-4000-8000-000000000311'),true,
  'active main tenant retains central access to active subtenant project');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000323',true);
select is(private.mizan_can_access_project('00000000-0000-4000-8000-000000000313'),false,
  'archived subtenant user cannot access active project');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000321',true);
select is(private.mizan_can_access_project('00000000-0000-4000-8000-000000000313'),false,
  'subtenant user cannot access another tenant project');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000324',true);
select is(private.mizan_can_access_project('00000000-0000-4000-8000-000000000312'),true,
  'platform admin retains explicit governance access to archived project');

select * from finish();
rollback;
