begin;
select plan(9);

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);

select set_config('request.jwt.claim.sub','d0ac672c-f1b4-4660-9f1f-deef096d4482',true);
select is(private.mizan_user_role(),'meter_reader','meter reader identity resolves');
select is(private.mizan_has_permission('meter.capture'),true,'meter reader keeps meter capture permission');
select is(private.mizan_has_permission('customer.manage'),false,'meter reader cannot claim customer management');
select is(private.mizan_can_write_project('2bee5204-050e-4fa6-8a85-36bbac986579','meters','insert'),false,'meter reader cannot write meters');

select set_config('request.jwt.claim.sub','e990c605-4cfc-4ac0-825d-76a277817fb4',true);
select is(private.mizan_user_role(),'collection_officer','collection officer identity resolves');
select is(private.mizan_has_permission('collection.record'),true,'collection officer keeps collection record permission');
select is(private.mizan_has_permission('collection.approve'),false,'collection officer cannot claim collection approval');

select set_config('request.jwt.claim.sub','512e9999-f00d-4b82-b6f1-5b4b1f779eb0',true);
select is(private.mizan_has_permission('customer.manage'),true,'project manager keeps customer management permission');
select is(private.mizan_has_permission('water.production.review'),true,'project manager keeps production review permission');

select * from finish();
rollback;
