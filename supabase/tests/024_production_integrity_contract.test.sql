-- Production integrity contract: structural indexes, household history, and obsolete financial RPC entry points.
begin;
select plan(1);

do $$
declare v_missing integer; v_customer_count integer; v_history_customer_count integer;
begin
  select count(*) into v_missing from (values
    ('customers','idx_customers_project_id'),('meters','idx_meters_project_id'),('meter_readings','idx_meter_readings_project_id'),('invoices','idx_invoices_project_id'),('payments','idx_payments_project_id'),('profiles','idx_profiles_project_id'),('maintenance_work_orders','idx_work_orders_project_id'),('service_interruptions','idx_service_interruptions_project_id')
  ) expected(table_name,index_name)
  where not exists (select 1 from pg_indexes i where i.schemaname='public' and i.tablename=expected.table_name and i.indexname=expected.index_name);
  if v_missing <> 0 then raise exception 'REQUIRED_PRODUCTION_INDEXES_MISSING: %',v_missing; end if;
  if to_regprocedure('public.mizan_create_invoice(uuid,uuid,uuid,date,date)') is not null and has_function_privilege('authenticated','public.mizan_create_invoice(uuid,uuid,uuid,date,date)','execute') then raise exception 'LEGACY_INVOICE_RPC_STILL_CLIENT_EXECUTABLE'; end if;
  if to_regprocedure('public.mizan_record_payment(uuid,numeric,text,text,text)') is not null and has_function_privilege('authenticated','public.mizan_record_payment(uuid,numeric,text,text,text)','execute') then raise exception 'LEGACY_PAYMENT_RPC_STILL_CLIENT_EXECUTABLE'; end if;
  select count(*) into v_customer_count from public.customers;
  select count(distinct customer_id) into v_history_customer_count from private.customer_household_history;
  if v_customer_count > 0 and v_history_customer_count <> v_customer_count then raise exception 'HOUSEHOLD_HISTORY_COVERAGE_FAILED: customers=%, history=%',v_customer_count,v_history_customer_count; end if;
end $$;

select ok(true, 'production integrity invariants hold');
select * from finish();
rollback;
