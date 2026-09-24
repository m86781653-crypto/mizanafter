/*
# MIZAN — Billing reconciliation hardening

Billing must consume an approved MRX reading rather than independently advancing
the meter snapshot. This prevents two competing sources of truth.

Adds:
- invoices.source_reading_id -> existing meter_readings
- one invoice per source reading
- server validation that p_current_reading matches the latest approved reading
- previous outstanding balance included in grand_total
- payment retry protection when a reference number is supplied

No replacement financial tables are created.
*/

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS source_reading_id uuid
  REFERENCES public.meter_readings(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_source_reading
  ON public.invoices(source_reading_id)
  WHERE source_reading_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_project_reference
  ON public.payments(project_id, reference_number)
  WHERE reference_number IS NOT NULL AND reference_number <> '';

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
  r public.meter_readings%ROWTYPE;
  t public.tariffs%ROWTYPE;
  tier record;
  inv public.invoices%ROWTYPE;
  prev numeric;
  consumption numeric;
  fixed_fee numeric;
  consumption_fee numeric := 0;
  previous_balance numeric := 0;
  remaining numeric;
  used_in_tier numeric;
  tier_to numeric;
  total numeric;
  grand_total numeric;
  invoice_number text;
  due_date date;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT private.mizan_has_permission('billing.manage')
     OR NOT private.mizan_can_access_project(p_project_id) THEN
    RAISE EXCEPTION 'BILLING_FORBIDDEN';
  END IF;

  SELECT *
  INTO c
  FROM public.customers
  WHERE id = p_customer_id
    AND project_id = p_project_id
  FOR SHARE;

  IF NOT FOUND OR c.status <> 'active' THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
  END IF;

  SELECT *
  INTO m
  FROM public.meters
  WHERE id = p_meter_id
    AND project_id = p_project_id
    AND customer_id = p_customer_id
  FOR SHARE;

  IF NOT FOUND OR m.status <> 'active' THEN
    RAISE EXCEPTION 'METER_NOT_FOUND';
  END IF;

  /*
   * MRX is the authoritative reading source. We do not advance meters here.
   * The invoice must be based on the latest approved, non-void reading.
   */
  SELECT *
  INTO r
  FROM public.meter_readings
  WHERE meter_id = p_meter_id
    AND project_id = p_project_id
    AND customer_id = p_customer_id
    AND status = 'approved'
  ORDER BY reading_date DESC, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPROVED_READING_REQUIRED';
  END IF;

  IF p_current_reading IS NULL OR p_current_reading <> r.reading_value THEN
    RAISE EXCEPTION 'CURRENT_READING_MUST_MATCH_MRX';
  END IF;

  SELECT *
  INTO inv
  FROM public.invoices
  WHERE source_reading_id = r.id
  LIMIT 1;

  IF FOUND THEN
    RETURN inv;
  END IF;

  prev := COALESCE(r.previous_reading, 0);
  consumption := COALESCE(r.consumption, r.reading_value - prev);

  SELECT *
  INTO t
  FROM public.tariffs
  WHERE project_id = p_project_id
    AND customer_type = c.customer_type
    AND is_active = true
    AND effective_from <= COALESCE(p_period_end, CURRENT_DATE)
    AND (effective_to IS NULL OR effective_to >= COALESCE(p_period_start, CURRENT_DATE))
  ORDER BY effective_from DESC, version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_TARIFF_NOT_FOUND';
  END IF;

  fixed_fee := COALESCE(t.fixed_fee, 0);
  remaining := consumption;

  FOR tier IN
    SELECT from_m3, to_m3, price_per_m3
    FROM public.tariff_tiers
    WHERE tariff_id = t.id
    ORDER BY from_m3
  LOOP
    EXIT WHEN remaining <= 0;
    tier_to := tier.to_m3;

    IF tier_to IS NULL THEN
      used_in_tier := remaining;
    ELSE
      used_in_tier := LEAST(
        remaining,
        GREATEST(tier_to - tier.from_m3, 0)
      );
    END IF;

    consumption_fee := consumption_fee + used_in_tier * tier.price_per_m3;
    remaining := remaining - used_in_tier;
  END LOOP;

  IF remaining > 0 THEN
    RAISE EXCEPTION 'TARIFF_TIERS_INCOMPLETE';
  END IF;

  /*
   * Carry existing water-service arrears into the current invoice.
   * Only unpaid/partial invoices for the same customer are included.
   */
  SELECT COALESCE(SUM(GREATEST(balance, 0)), 0)
  INTO previous_balance
  FROM public.invoices
  WHERE customer_id = p_customer_id
    AND project_id = p_project_id
    AND status IN ('unpaid', 'partial')
    AND balance > 0;

  total := fixed_fee + consumption_fee;
  grand_total := total + previous_balance;
  invoice_number := public.next_seq_number('INV');
  due_date := COALESCE(p_period_end, CURRENT_DATE) + 15;

  INSERT INTO public.invoices (
    project_id,
    customer_id,
    meter_id,
    source_reading_id,
    invoice_number,
    billing_period_start,
    billing_period_end,
    previous_reading,
    current_reading,
    consumption_m3,
    fixed_fee,
    consumption_fee,
    total_amount,
    previous_balance,
    grand_total,
    amount_paid,
    balance,
    status,
    due_date
  )
  VALUES (
    p_project_id,
    p_customer_id,
    p_meter_id,
    r.id,
    invoice_number,
    p_period_start,
    p_period_end,
    prev,
    r.reading_value,
    consumption,
    fixed_fee,
    consumption_fee,
    total,
    previous_balance,
    grand_total,
    0,
    grand_total,
    'unpaid',
    due_date
  )
  RETURNING * INTO inv;

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
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT';
  END IF;

  SELECT *
  INTO inv
  FROM public.invoices
  WHERE id = p_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVOICE_NOT_FOUND';
  END IF;

  IF NOT private.mizan_has_permission('collection.record')
     OR NOT private.mizan_can_access_project(inv.project_id) THEN
    RAISE EXCEPTION 'COLLECTION_FORBIDDEN';
  END IF;

  IF p_reference_number IS NOT NULL AND p_reference_number <> '' THEN
    SELECT *
    INTO pay
    FROM public.payments
    WHERE project_id = inv.project_id
      AND reference_number = p_reference_number
    LIMIT 1;

    IF FOUND THEN
      RETURN pay;
    END IF;
  END IF;

  IF p_amount > COALESCE(inv.balance, 0) THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE';
  END IF;

  new_paid := COALESCE(inv.amount_paid, 0) + p_amount;
  new_balance := GREATEST(COALESCE(inv.grand_total, 0) - new_paid, 0);
  new_status := CASE WHEN new_balance = 0 THEN 'paid' ELSE 'partial' END;

  INSERT INTO public.payments (
    project_id,
    invoice_id,
    customer_id,
    receipt_number,
    amount,
    payment_method,
    collector_name,
    reference_number,
    notes
  )
  VALUES (
    inv.project_id,
    inv.id,
    inv.customer_id,
    public.next_seq_number('RCP'),
    p_amount,
    COALESCE(NULLIF(p_payment_method, ''), 'cash'),
    NULL,
    NULLIF(p_reference_number, ''),
    p_notes
  )
  RETURNING * INTO pay;

  UPDATE public.invoices
  SET amount_paid = new_paid,
      balance = new_balance,
      status = new_status,
      updated_at = now()
  WHERE id = inv.id;

  RETURN pay;
END;
$$;

REVOKE ALL ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) TO authenticated;

REVOKE ALL ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text) TO authenticated;

COMMENT ON FUNCTION public.mizan_create_invoice IS
  'Server-authoritative invoice generation from the latest approved MRX reading; does not advance meter state.';
COMMENT ON FUNCTION public.mizan_record_payment IS
  'Transactional collection recording with optional reference-based idempotency.';
