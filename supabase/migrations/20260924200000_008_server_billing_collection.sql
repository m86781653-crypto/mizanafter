/*
# MIZAN — Server-authoritative billing and collection

Extends existing invoices/payments/tariffs. No replacement financial tables.
All monetary calculations and invoice/payment balance transitions happen in
Postgres transactions after tenant/project authorization.
*/

CREATE OR REPLACE FUNCTION public.mizan_create_invoice(
  p_project_id uuid,
  p_customer_id uuid,
  p_meter_id uuid,
  p_current_reading numeric,
  p_period_start date,
  p_period_end date
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c public.customers%ROWTYPE;
  m public.meters%ROWTYPE;
  t public.tariffs%ROWTYPE;
  tier record;
  inv public.invoices%ROWTYPE;
  prev numeric;
  consumption numeric;
  fixed_fee numeric;
  consumption_fee numeric := 0;
  remaining numeric;
  used_in_tier numeric;
  tier_to numeric;
  total numeric;
  invoice_number text;
  due_date date;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT private.mizan_has_permission('billing.manage')
     OR NOT private.mizan_can_access_project(p_project_id) THEN
    RAISE EXCEPTION 'BILLING_FORBIDDEN';
  END IF;

  SELECT * INTO c FROM public.customers WHERE id=p_customer_id AND project_id=p_project_id FOR SHARE;
  IF NOT FOUND OR c.status <> 'active' THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;

  SELECT * INTO m FROM public.meters WHERE id=p_meter_id AND project_id=p_project_id AND customer_id=p_customer_id FOR UPDATE;
  IF NOT FOUND OR m.status <> 'active' THEN RAISE EXCEPTION 'METER_NOT_FOUND'; END IF;

  IF p_current_reading IS NULL OR p_current_reading < m.last_reading THEN
    RAISE EXCEPTION 'INVALID_CURRENT_READING';
  END IF;

  prev := COALESCE(m.last_reading,0);
  consumption := p_current_reading - prev;

  SELECT * INTO t
  FROM public.tariffs
  WHERE project_id=p_project_id
    AND customer_type=c.customer_type
    AND is_active=true
    AND effective_from <= COALESCE(p_period_end,CURRENT_DATE)
    AND (effective_to IS NULL OR effective_to >= COALESCE(p_period_start,CURRENT_DATE))
  ORDER BY effective_from DESC, version DESC
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_TARIFF_NOT_FOUND'; END IF;

  fixed_fee := COALESCE(t.fixed_fee,0);
  remaining := consumption;

  FOR tier IN
    SELECT from_m3, to_m3, price_per_m3
    FROM public.tariff_tiers
    WHERE tariff_id=t.id
    ORDER BY from_m3
  LOOP
    EXIT WHEN remaining <= 0;
    tier_to := COALESCE(tier.to_m3, NULL);
    IF tier_to IS NULL THEN
      used_in_tier := remaining;
    ELSE
      used_in_tier := LEAST(remaining, GREATEST(tier_to - tier.from_m3,0));
    END IF;
    consumption_fee := consumption_fee + used_in_tier * tier.price_per_m3;
    remaining := remaining - used_in_tier;
  END LOOP;

  IF remaining > 0 THEN
    RAISE EXCEPTION 'TARIFF_TIERS_INCOMPLETE';
  END IF;

  total := fixed_fee + consumption_fee;
  invoice_number := public.next_seq_number('INV');
  due_date := COALESCE(p_period_end,CURRENT_DATE) + 15;

  INSERT INTO public.invoices (
    project_id, customer_id, meter_id, invoice_number,
    billing_period_start, billing_period_end,
    previous_reading, current_reading, consumption_m3,
    fixed_fee, consumption_fee, total_amount, grand_total,
    amount_paid, balance, status, due_date
  )
  VALUES (
    p_project_id,p_customer_id,p_meter_id,invoice_number,
    p_period_start,p_period_end,prev,p_current_reading,consumption,
    fixed_fee,consumption_fee,total,total,0,total,'unpaid',due_date
  )
  RETURNING * INTO inv;

  UPDATE public.meters
  SET last_reading=p_current_reading,
      last_reading_date=now(),
      updated_at=now()
  WHERE id=p_meter_id;

  RETURN inv;
END;
$$;

CREATE OR REPLACE FUNCTION public.mizan_record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'cash',
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  pay public.payments%ROWTYPE;
  new_paid numeric;
  new_balance numeric;
  new_status text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT'; END IF;

  SELECT * INTO inv
  FROM public.invoices
  WHERE id=p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;

  IF NOT private.mizan_has_permission('collection.record')
     OR NOT private.mizan_can_access_project(inv.project_id) THEN
    RAISE EXCEPTION 'COLLECTION_FORBIDDEN';
  END IF;

  IF p_amount > COALESCE(inv.balance,0) THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE';
  END IF;

  new_paid := COALESCE(inv.amount_paid,0) + p_amount;
  new_balance := GREATEST(COALESCE(inv.grand_total,0) - new_paid,0);
  new_status := CASE WHEN new_balance = 0 THEN 'paid' ELSE 'partial' END;

  INSERT INTO public.payments (
    project_id, invoice_id, customer_id, receipt_number,
    amount, payment_method, collector_name, reference_number, notes
  )
  VALUES (
    inv.project_id,inv.id,inv.customer_id,public.next_seq_number('RCP'),
    p_amount,COALESCE(NULLIF(p_payment_method,''),'cash'),
    NULL, p_reference_number,p_notes
  )
  RETURNING * INTO pay;

  UPDATE public.invoices
  SET amount_paid=new_paid,balance=new_balance,status=new_status,updated_at=now()
  WHERE id=inv.id;

  RETURN pay;
END;
$$;

REVOKE ALL ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) TO authenticated;

REVOKE ALL ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text) TO authenticated;

COMMENT ON FUNCTION public.mizan_create_invoice IS
  'Server-authoritative water-service invoice calculation and meter snapshot transition.';
COMMENT ON FUNCTION public.mizan_record_payment IS
  'Transactional collection recording and invoice balance transition.';
