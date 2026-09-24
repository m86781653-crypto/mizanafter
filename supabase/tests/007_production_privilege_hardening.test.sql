begin;

select plan(12);

select is(
  has_table_privilege('anon', 'public.projects', 'select'),
  false,
  'anonymous clients cannot select application projects'
);

select is(
  has_table_privilege('anon', 'public.customers', 'select'),
  false,
  'anonymous clients cannot select application customers'
);

select is(
  has_table_privilege('anon', 'public.meter_readings', 'select'),
  false,
  'anonymous clients cannot select meter readings'
);

select is(
  has_table_privilege('anon', 'public.invoices', 'select'),
  false,
  'anonymous clients cannot select invoices'
);

select is(
  has_table_privilege('authenticated', 'public.meter_readings', 'insert'),
  false,
  'authenticated clients cannot directly insert meter readings'
);

select is(
  has_table_privilege('authenticated', 'public.meter_readings', 'update'),
  false,
  'authenticated clients cannot directly update meter readings'
);

select is(
  has_table_privilege('authenticated', 'public.invoices', 'insert'),
  false,
  'authenticated clients cannot directly insert invoices'
);

select is(
  has_table_privilege('authenticated', 'public.payments', 'insert'),
  false,
  'authenticated clients cannot directly insert payments'
);

select is(
  has_table_privilege('authenticated', 'public.meters', 'update'),
  false,
  'authenticated clients cannot directly update meter state'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid)',
    'execute'
  ),
  true,
  'authenticated clients can use the MRX server capture RPC'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date)',
    'execute'
  ),
  true,
  'authenticated clients can use the server invoice RPC'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.mizan_record_payment(uuid,numeric,text,text,text)',
    'execute'
  ),
  true,
  'authenticated clients can use the server payment RPC'
);

select * from finish();

rollback;
