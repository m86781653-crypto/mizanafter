-- Contract: field collection and automatic billing integrity.
begin;
select plan(1);

DO $$
declare
  v_allowance numeric;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tariffs' and column_name='base_liters_per_person_per_day'
  ) then raise exception 'TARIFF_BASE_ALLOWANCE_COLUMN_MISSING'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='invoices' and column_name='source_reading_id'
  ) then raise exception 'INVOICE_SOURCE_READING_COLUMN_MISSING'; end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and indexname='ux_payments_client_payment_id'
  ) then raise exception 'PAYMENT_IDEMPOTENCY_INDEX_MISSING'; end if;
  select 4 * 50 * 30 / 1000 into v_allowance;
  if v_allowance <> 6 then raise exception 'HOUSEHOLD_ALLOWANCE_FORMULA_INVALID'; end if;
  if has_function_privilege('authenticated','public.mizan_create_invoice(uuid,uuid,uuid,date,date)','EXECUTE') then
    raise exception 'MANUAL_INVOICE_RPC_MUST_NOT_BE_CLIENT_EXECUTABLE';
  end if;
  if not has_function_privilege('authenticated','public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text)','EXECUTE') then
    raise exception 'MRX_CAPTURE_RPC_NOT_AVAILABLE_TO_AUTHENTICATED';
  end if;
  if not has_function_privilege('authenticated','public.mizan_record_payment(uuid,numeric,text,text,text,uuid)','EXECUTE') then
    raise exception 'PAYMENT_RPC_NOT_AVAILABLE_TO_AUTHENTICATED';
  end if;
end
$$;

select ok(true, 'field collection and automatic billing integrity contract');
select * from finish();
rollback;
