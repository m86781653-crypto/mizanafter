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
  has_function_privilege('authenticated','public.mizan_report_fault(uuid,text,text,text,uuid,uuid,uuid)','EXECUTE'),
  true,
  'authenticated can report faults through governed RPC'
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
  has_function_privilege('authenticated','public.mizan_update_work_order_status(uuid,text,text)','EXECUTE'),
  true,
  'authenticated can update work-order status through governed RPC'
);

select is(
  has_function_privilege('anon','public.mizan_update_work_order_status(uuid,text,text)','EXECUTE'),
  false,
  'anon cannot update work-order status'
);

select is(
  has_function_privilege('authenticated','public.mizan_report_service_interruption(uuid,text,text,text,text,text,timestamptz,integer,numeric)','EXECUTE'),
  true,
  'authenticated can report service interruptions through governed RPC'
);

select is(
  has_function_privilege('anon','public.mizan_report_service_interruption(uuid,text,text,text,text,text,timestamptz,integer,numeric)','EXECUTE'),
  false,
  'anon cannot report service interruptions'
);

select is(
  count(*)::integer,
  1,
  'fault trigger creates maintenance work order automatically'
)
from pg_trigger
where tgname = 'trg_fault_to_work_order';

select * from finish();
rollback;