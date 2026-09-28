-- Billing contract tests: variable periods, daily tier scaling, and non-approval reading source.
begin;
select plan(3);

select ok(
  exists (select 1 from information_schema.columns where table_schema='public' and table_name='tariffs' and column_name='reference_period_days')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='invoices' and column_name='billing_days')
  and exists (select 1 from information_schema.columns where table_schema='public' and table_name='invoices' and column_name='calculation_snapshot'),
  'variable-period billing columns exist'
);

do $$
declare
  v_tariff uuid := '00000000-0000-4000-8000-000000000981';
  v_tier uuid := '00000000-0000-4000-8000-000000000982';
  v_fee numeric;
begin
  insert into public.tariffs(
    id,project_id,name_ar,customer_type,fixed_fee,
    base_liters_per_person_per_day,base_price_per_m3,
    reference_period_days,effective_from,is_active,version
  )
  values(
    v_tariff,null,'TEST BILLING CONTRACT','residential',0,50,0,30,'2026-01-01',true,99999
  );

  insert into public.tariff_tiers(id,tariff_id,from_m3,to_m3,price_per_m3)
  values(v_tier,v_tariff,0,null,20);

  v_fee := private.mizan_calculate_consumption_fee_for_period(v_tariff,4,40);
  if v_fee <> 80 then
    raise exception 'VARIABLE_PERIOD_TIER_CALCULATION_FAILED: %', v_fee;
  end if;
end
$$;

select ok(
  to_regprocedure('private.mizan_issue_invoice_for_reading(uuid,date,date)') is not null
  and to_regprocedure('public.mrx_capture_meter_reading(uuid,numeric,timestamptz,text,text,numeric,numeric,numeric,numeric,numeric,text,text,uuid,text)') is not null,
  'variable-period invoice engine and MRX reading RPC exist'
);

select * from finish();
rollback;
