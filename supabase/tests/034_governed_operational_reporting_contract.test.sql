begin;
select plan(12);
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='mizan_operational_report' and pg_get_function_identity_arguments(p.oid)='p_project_id uuid, p_period_start date, p_period_end date'),1,'operational report RPC exists');
select is((select p.prorettype::regtype::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='mizan_operational_report' and pg_get_function_identity_arguments(p.oid)='p_project_id uuid, p_period_start date, p_period_end date'),'jsonb','operational report returns jsonb');
select is((select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='mizan_operational_report' and pg_get_function_identity_arguments(p.oid)='p_project_id uuid, p_period_start date, p_period_end date'),false,'operational report is security invoker');
select is(has_function_privilege('anon','public.mizan_operational_report(uuid,date,date)','EXECUTE'),false,'anon cannot execute operational report');
select is(has_function_privilege('authenticated','public.mizan_operational_report(uuid,date,date)','EXECUTE'),true,'authenticated can execute operational report');
select is(has_table_privilege('authenticated','public.customers','SELECT'),true,'authenticated can read customers for report');
select is(has_table_privilege('authenticated','public.invoices','SELECT'),true,'authenticated can read invoices for report');
select is(has_table_privilege('authenticated','public.pump_operation_cycles','SELECT'),true,'authenticated can read production cycles for report');
select ok((select pg_get_functiondef('public.mizan_operational_report(uuid,date,date)'::regprocedure) ~ '(?s)recorded_consumption_m3.*from public.meter_readings r'),'operational water balance consumption uses governed meter readings');
select ok((select pg_get_functiondef('public.mizan_operational_report(uuid,date,date)'::regprocedure) ~ $$p_period_start::timestamp at time zone 'Asia/Aden'$$),'operational report uses Yemen business-day start boundary');
select ok((select pg_get_viewdef('public.mizan_water_balance'::regclass,true) ~* $$AT TIME ZONE.*Asia/Aden$$),'water balance view groups by Yemen business date');
select ok(position('p_period_end-1' in pg_get_functiondef('public.mizan_maintenance_report(uuid,date,date)'::regprocedure)) > 0,'maintenance report uses exclusive end semantics');

select * from finish();
rollback;