begin;
select plan(6);

select ok(to_regprocedure('public.mizan_record_payment(uuid,numeric,text,text,text,uuid)') is not null,
  'governed six-argument payment RPC exists');
select ok((select pg_get_functiondef('public.mizan_record_payment(uuid,numeric,text,text,text,uuid)'::regprocedure) ~ 'pg_advisory_xact_lock'),
  'payment recording serializes invoice attempts with transaction advisory lock');
select ok(not ((select pg_get_functiondef('public.mizan_record_payment(uuid,numeric,text,text,text,uuid)'::regprocedure)) ~* 'for update'),
  'payment recording does not require invoice UPDATE lock privilege');
select is(has_table_privilege('authenticated','public.invoices','UPDATE'),false,
  'authenticated is not granted direct invoice UPDATE');
select is(has_table_privilege('authenticated','public.payments','INSERT'),false,
  'authenticated is not granted direct payment INSERT');
select is(has_function_privilege('authenticated','public.mizan_record_payment(uuid,numeric,text,text,text,uuid)','EXECUTE'),true,
  'authenticated can execute governed payment RPC');

select * from finish();
rollback;
