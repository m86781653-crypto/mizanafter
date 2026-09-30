begin;
select plan(18);

select is(has_function_privilege('authenticated','public.mizan_assign_work_order(uuid,text,date)','EXECUTE'),true,'authenticated can assign through governed RPC');
select is(has_function_privilege('anon','public.mizan_assign_work_order(uuid,text,date)','EXECUTE'),false,'anon cannot assign');
select is(has_function_privilege('authenticated','public.mizan_record_work_order_execution(uuid,numeric,text,numeric,text)','EXECUTE'),true,'authenticated can record execution through governed RPC');
select is(has_function_privilege('anon','public.mizan_record_work_order_execution(uuid,numeric,text,numeric,text)','EXECUTE'),false,'anon cannot record execution');
select is(has_function_privilege('authenticated','public.mizan_close_work_order(uuid,text)','EXECUTE'),true,'authenticated can request governed closure');
select is(has_function_privilege('anon','public.mizan_close_work_order(uuid,text)','EXECUTE'),false,'anon cannot close');
select is(has_function_privilege('authenticated','public.mizan_maintenance_report(uuid,date,date)','EXECUTE'),true,'authenticated can generate arbitrary-period maintenance report');
select is(has_function_privilege('anon','public.mizan_maintenance_report(uuid,date,date)','EXECUTE'),false,'anon cannot generate arbitrary-period maintenance report');
select is(has_function_privilege('service_role','public.mizan_assign_work_order(uuid,text,date)','EXECUTE'),false,'service_role is not an application execution path');
select is(has_function_privilege('service_role','public.mizan_record_work_order_execution(uuid,numeric,text,numeric,text)','EXECUTE'),false,'service_role is not an application execution path');
select is((select count(*)::integer from information_schema.columns where table_schema='public' and table_name='maintenance_work_orders' and column_name='memo_issued_at'),1,'maintenance memo issuance metadata exists');
select is((select count(*)::integer from information_schema.columns where table_schema='public' and table_name='maintenance_work_orders' and column_name='completed_date'),1,'maintenance completion timestamp exists');
select is((select count(*)::integer from information_schema.columns where table_schema='public' and table_name='maintenance_work_orders' and column_name='downtime_hours'),1,'maintenance downtime field exists');
select is((select count(*)::integer from information_schema.columns where table_schema='public' and table_name='maintenance_work_orders' and column_name='closed_at'),1,'maintenance closure timestamp exists');
select is((select count(*)::integer from information_schema.columns where table_schema='public' and table_name='maintenance_work_orders' and column_name='closed_by'),1,'maintenance closure actor exists');
select is((select count(*)::integer from pg_trigger where tgname='mizan_fault_create_work_order' and tgrelid='public.faults'::regclass),1,'fault trigger automatically creates work order');
select is(has_function_privilege('authenticated','public.mizan_update_work_order_status(uuid,text,text)','EXECUTE'),false,'legacy work-order status transition RPC remains retired');
select is(has_function_privilege('service_role','public.mizan_maintenance_report(uuid,date,date)','EXECUTE'),false,'service_role is not used for reporting');

select * from finish();
rollback;