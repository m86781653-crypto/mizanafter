begin;
select plan(6);

select ok(to_regprocedure('public.mizan_add_meter_to_customer(uuid,uuid,text,text,integer,text)') is not null,'existing-customer meter RPC exists');
select is(has_function_privilege('anon','public.mizan_add_meter_to_customer(uuid,uuid,text,text,integer,text)','EXECUTE'),false,'anon cannot execute existing-customer meter RPC');
select is(has_function_privilege('authenticated','public.mizan_add_meter_to_customer(uuid,uuid,text,text,integer,text)','EXECUTE'),true,'authenticated may execute governed meter RPC');
select ok((select prosecdef from pg_proc where oid='public.mizan_add_meter_to_customer(uuid,uuid,text,text,integer,text)'::regprocedure),'meter RPC is SECURITY DEFINER');
select ok((select proconfig::text from pg_proc where oid='public.mizan_add_meter_to_customer(uuid,uuid,text,text,integer,text)'::regprocedure) like '%search_path=%','meter RPC has controlled search_path');
select is(has_table_privilege('authenticated','public.meters','INSERT'),false,'authenticated still has no direct meter INSERT privilege');

select * from finish();
rollback;
