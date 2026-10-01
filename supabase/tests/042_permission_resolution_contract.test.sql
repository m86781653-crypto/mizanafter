begin;
select plan(8);

-- Self-contained fixtures for clean-room execution. Production rows are never referenced.
insert into auth.users(id,aud,role,email,email_confirmed_at,created_at,updated_at)
values
 ('00000000-0000-4000-8000-000000000101','authenticated','authenticated','mizan-perm-reader@test.invalid',now(),now(),now()),
 ('00000000-0000-4000-8000-000000000102','authenticated','authenticated','mizan-perm-collector@test.invalid',now(),now(),now()),
 ('00000000-0000-4000-8000-000000000103','authenticated','authenticated','mizan-perm-manager@test.invalid',now(),now(),now());

insert into public.profiles(id,email,full_name,role,must_change_password)
values
 ('00000000-0000-4000-8000-000000000101','mizan-perm-reader@test.invalid','Contract Meter Reader','meter_reader',false),
 ('00000000-0000-4000-8000-000000000102','mizan-perm-collector@test.invalid','Contract Collection Officer','collection_officer',false),
 ('00000000-0000-4000-8000-000000000103','mizan-perm-manager@test.invalid','Contract Project Manager','project_manager',false);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select is(private.mizan_user_role(),'meter_reader','meter reader identity resolves');
select is(private.mizan_has_permission('meter.capture'),true,'meter reader keeps meter capture permission');
select is(private.mizan_has_permission('customer.manage'),false,'meter reader cannot claim customer management');
select is(private.mizan_has_permission('governance.tenant.manage'),false,'meter reader cannot claim governance tenant management');
select is(private.mizan_has_permission('__permission_that_does_not_exist__'),false,'unknown permission code is denied');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select is(private.mizan_user_role(),'collection_officer','collection officer identity resolves');
select is(private.mizan_has_permission('collection.approve'),false,'collection officer cannot claim collection approval');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
select is(private.mizan_has_permission('customer.manage'),true,'project manager keeps customer management permission');

select * from finish();
rollback;
