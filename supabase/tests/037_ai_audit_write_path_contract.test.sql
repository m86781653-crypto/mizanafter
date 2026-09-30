begin;
select plan(6);

select ok(to_regprocedure('public.mizan_log_ai_interaction(uuid,text,text,text,boolean,text)') is not null,'AI audit RPC exists');
select is(has_function_privilege('anon','public.mizan_log_ai_interaction(uuid,text,text,text,boolean,text)','EXECUTE'),false,'anon cannot execute AI audit RPC');
select is(has_function_privilege('authenticated','public.mizan_log_ai_interaction(uuid,text,text,text,boolean,text)','EXECUTE'),true,'authenticated may execute governed AI audit RPC');
select is(has_table_privilege('authenticated','public.ai_logs','INSERT'),false,'authenticated cannot insert AI logs directly');
select ok((select prosecdef from pg_proc where oid='public.mizan_log_ai_interaction(uuid,text,text,text,boolean,text)'::regprocedure),'AI audit RPC is SECURITY DEFINER');
select ok(position('search_path=' in coalesce((select proconfig::text from pg_proc where oid='public.mizan_log_ai_interaction(uuid,text,text,text,boolean,text)'::regprocedure),'')) > 0,'AI audit RPC has a controlled function search_path');

select * from finish();
rollback;
