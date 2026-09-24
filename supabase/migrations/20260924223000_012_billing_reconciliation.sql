/* MIZAN — billing reconciliation with MRX */
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS source_reading_id uuid REFERENCES public.meter_readings(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoices_source_reading_id ON public.invoices(source_reading_id) WHERE source_reading_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_payments_project_reference ON public.payments(project_id,reference_number) WHERE reference_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mizan_create_invoice(p_project_id uuid,p_customer_id uuid,p_meter_id uuid,p_current_reading numeric,p_period_start date,p_period_end date)
RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.customers%ROWTYPE; m public.meters%ROWTYPE; t public.tariffs%ROWTYPE; r public.meter_readings%ROWTYPE; tier record; inv public.invoices%ROWTYPE; prev numeric; consumption numeric; fixed_fee numeric; consumption_fee numeric:=0; remaining numeric; used_in_tier numeric; total numeric; invoice_number text; due_date date; prior_arrears numeric:=0;
BEGIN
IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
IF NOT private.mizan_has_permission('billing.manage') OR NOT private.mizan_can_access_project(p_project_id) THEN RAISE EXCEPTION 'BILLING_FORBIDDEN'; END IF;
SELECT * INTO c FROM public.customers WHERE id=p_customer_id AND project_id=p_project_id FOR SHARE; IF NOT FOUND OR c.status<>'active' THEN RAISE EXCEPTION 'CUSTOMER_NOT_FOUND'; END IF;
SELECT * INTO m FROM public.meters WHERE id=p_meter_id AND project_id=p_project_id AND customer_id=p_customer_id FOR UPDATE; IF NOT FOUND OR m.status<>'active' THEN RAISE EXCEPTION 'METER_NOT_FOUND'; END IF;
SELECT * INTO r FROM public.meter_readings WHERE meter_id=p_meter_id AND project_id=p_project_id AND customer_id=p_customer_id AND status='approved' ORDER BY reading_date DESC,created_at DESC LIMIT 1 FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'APPROVED_MRX_READING_REQUIRED'; END IF;
IF r.reading_value<>p_current_reading THEN RAISE EXCEPTION 'CURRENT_READING_MUST_MATCH_MRX'; END IF;
IF EXISTS(SELECT 1 FROM public.invoices WHERE source_reading_id=r.id) THEN SELECT * INTO inv FROM public.invoices WHERE source_reading_id=r.id; RETURN inv; END IF;
prev:=r.previous_reading; consumption:=r.consumption;
SELECT * INTO t FROM public.tariffs WHERE project_id=p_project_id AND customer_type=c.customer_type AND is_active=true AND effective_from<=COALESCE(p_period_end,CURRENT_DATE) AND (effective_to IS NULL OR effective_to>=COALESCE(p_period_start,CURRENT_DATE)) ORDER BY effective_from DESC,version DESC LIMIT 1; IF NOT FOUND THEN RAISE EXCEPTION 'ACTIVE_TARIFF_NOT_FOUND'; END IF;
fixed_fee:=COALESCE(t.fixed_fee,0); remaining:=consumption;
FOR tier IN SELECT from_m3,to_m3,price_per_m3 FROM public.tariff_tiers WHERE tariff_id=t.id ORDER BY from_m3 LOOP EXIT WHEN remaining<=0; used_in_tier:=CASE WHEN tier.to_m3 IS NULL THEN remaining ELSE LEAST(remaining,GREATEST(tier.to_m3-tier.from_m3,0)) END; consumption_fee:=consumption_fee+used_in_tier*tier.price_per_m3; remaining:=remaining-used_in_tier; END LOOP;
IF remaining>0 THEN RAISE EXCEPTION 'TARIFF_TIERS_INCOMPLETE'; END IF;
SELECT COALESCE(SUM(GREATEST(i.balance,0)),0) INTO prior_arrears FROM public.invoices i WHERE i.customer_id=p_customer_id AND i.project_id=p_project_id AND i.status IN('unpaid','partial','overdue');
total:=fixed_fee+consumption_fee; invoice_number:=public.next_seq_number('INV'); due_date:=COALESCE(p_period_end,CURRENT_DATE)+15;
INSERT INTO public.invoices(project_id,customer_id,meter_id,invoice_number,billing_period_start,billing_period_end,previous_reading,current_reading,consumption_m3,fixed_fee,consumption_fee,total_amount,previous_balance,grand_total,amount_paid,balance,status,due_date,source_reading_id) VALUES(p_project_id,p_customer_id,p_meter_id,invoice_number,p_period_start,p_period_end,prev,p_current_reading,consumption,fixed_fee,consumption_fee,total,prior_arrears,total+prior_arrears,0,total+prior_arrears,'unpaid',due_date,r.id) RETURNING * INTO inv;
RETURN inv; END; $$;
REVOKE ALL ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.mizan_create_invoice(uuid,uuid,uuid,numeric,date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.mizan_record_payment(p_invoice_id uuid,p_amount numeric,p_payment_method text DEFAULT 'cash',p_reference_number text DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE inv public.invoices%ROWTYPE; pay public.payments%ROWTYPE; new_paid numeric; new_balance numeric; new_status text;
BEGIN
IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
SELECT * INTO inv FROM public.invoices WHERE id=p_invoice_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;
IF NOT private.mizan_has_permission('collection.record') OR NOT private.mizan_can_access_project(inv.project_id) THEN RAISE EXCEPTION 'COLLECTION_FORBIDDEN'; END IF;
IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT'; END IF;
IF p_reference_number IS NOT NULL THEN SELECT * INTO pay FROM public.payments WHERE project_id=inv.project_id AND reference_number=p_reference_number LIMIT 1; IF FOUND THEN RETURN pay; END IF; END IF;
IF p_amount>COALESCE(inv.balance,0) THEN RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE'; END IF;
new_paid:=COALESCE(inv.amount_paid,0)+p_amount; new_balance:=GREATEST(COALESCE(inv.grand_total,0)-new_paid,0); new_status:=CASE WHEN new_balance=0 THEN 'paid' ELSE 'partial' END;
INSERT INTO public.payments(project_id,invoice_id,customer_id,receipt_number,amount,payment_method,collector_name,reference_number,notes) VALUES(inv.project_id,inv.id,inv.customer_id,public.next_seq_number('RCP'),p_amount,COALESCE(NULLIF(p_payment_method,''),'cash'),NULL,p_reference_number,p_notes) RETURNING * INTO pay;
UPDATE public.invoices SET amount_paid=new_paid,balance=new_balance,status=new_status,updated_at=now() WHERE id=inv.id; RETURN pay;
EXCEPTION WHEN unique_violation THEN
  IF p_reference_number IS NOT NULL THEN
    SELECT * INTO pay FROM public.payments WHERE project_id=inv.project_id AND reference_number=p_reference_number LIMIT 1;
    IF FOUND THEN RETURN pay; END IF;
  END IF;
  RAISE;
END; $$;
REVOKE ALL ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.mizan_record_payment(uuid,numeric,text,text,text) TO authenticated;
