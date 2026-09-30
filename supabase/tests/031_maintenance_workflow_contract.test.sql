begin;

select plan(15);

select is(
  has_table_privilege('authenticated','public.faults','INSERT'),
  false,
  'authenticated cannot insert faults directly'
);

select is(
  has_table_privilege('authenticated','public.faults','UPDATE'),
  false,
  'authenticated cannot update faults directly'
);

select is(
  has_table_privilege('authenticated','public.maintenance_work_orders','INSERT'),
  false,
  'authenticated cannot insert work orders directly'
);

select is(
  has_table_privilege('authenticated','public.maintenance_work_orders','UPDATE'),
  false,
  'authenticated cannot update work orders directly'
);

select is(
  has_table_privilege('authenticated','public.service_interruptions','INSERT'),
  false,
  'authenticated cannot insert service interruptions directly'
);

select is(
  has_table_privilege('authenticated','public.service_interruptions','UPDATE'),
  false,
  'authenticated cannot update service interruptions directly'
);

select is(
  has_function_privilege('authenticated','public.mizan_report_fault_with_impact(uuid,text,text,text,uuid,uuid,uuid,boolean,text,timestamptz,text,text,text,uuid,numeric)','EXECUTE'),
  true,
  'authenticated can report faults with governed interruption decision'
);

select is(
  has_function_privilege('anon','public.mizan_report_fault(uuid,text,text,text,uuid,uuid,uuid)','EXECUTE'),
  false,
  'anon cannot report faults'
);

select is(
  has_function_privilege('authenticated','public.mizan_create_work_order(uuid,text,text,text,text,date,uuid,uuid,uuid,uuid)','EXECUTE'),
  true,
  'authenticated can create work orders through governed RPC'
);

select is(
  has_function_privilege('anon','public.mizan_create_work_order(uuid,text,text,text,text,date,uuid,uuid,uuid,uuid)','EXECUTE'),
  false,
  'anon cannot create work orders'
);

select is(
  has_function_privilege('authenticated','public.mizan_record_work_order_execution(uuid,numeric,text,numeric,text)','EXECUTE'),
  true,
  'authenticated can execute work orders through governed RPC'
);

select is(
  has_function_privilege('anon','public.mizan_record_work_order_execution(uuid,numeric,text,numeric,text)','EXECUTE'),
  false,
  'anon cannot execute work orders'
);

select is(
  has_function_privilege('authenticated','public.mizan_close_work_order(uuid,text)','EXECUTE'),
  true,
  'authenticated can request governed work-order closure'
);

select is(
  has_function_privilege('anon','public.mizan_close_work_order(uuid,text)','EXECUTE'),
  false,
  'anon cannot close work orders'
);

select is(
  count(*)::integer,
  1,
  'fault trigger creates maintenance work order automatically'
)
from pg_trigger
where tgname = 'mizan_fault_create_work_order';

select * from finish();
rollback;