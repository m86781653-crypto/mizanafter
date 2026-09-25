-- Enforce operational write boundaries inside privileged RPCs.
-- Central tenant managers retain read/oversight access to child projects,
-- but cannot perform child-project billing, collection, or meter capture.

CREATE OR REPLACE FUNCTION public.mizan_create_invoice(p_project_id uuid, p_customer_id uuid, p_meter_id uuid, p_current_reading numeric, p_period_start date, p_period_end date)
RETURNS public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE c public.customers%ROWTYPE; m public.meters%ROWTYPE; t public.tariffs%ROWTYPE; r public.meter_readings%ROWTYPE; tier record; inv public.invoices%ROWTYPE; prev numeric; consumption numeric; fixed_fee numeric; consumption_fee numeric:=0; remaining numeric; used_in_tier numeric; total numeric; invoice_number text; due_date date; prior_arrears numeric:=0;
BEGIN
IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
IF NOT private.mizan_has_permission('billing.manage') OR NOT private.mizan_can_write_project(p_project_id,'invoices','insert') THEN RAISE EXCEPTION 'BILLING_FORBIDDEN'; END IF;
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
RETURN inv; END; $function$;

CREATE OR REPLACE FUNCTION public.mizan_record_payment(p_invoice_id uuid, p_amount numeric, p_payment_method text DEFAULT 'cash', p_reference_number text DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS public.payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE inv public.invoices%ROWTYPE; pay public.payments%ROWTYPE; new_paid numeric; new_balance numeric; new_status text;
BEGIN
IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
SELECT * INTO inv FROM public.invoices WHERE id=p_invoice_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND'; END IF;
IF NOT private.mizan_has_permission('collection.record') OR NOT private.mizan_can_write_project(inv.project_id,'payments','insert') THEN RAISE EXCEPTION 'COLLECTION_FORBIDDEN'; END IF;
IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT'; END IF;
IF p_reference_number IS NOT NULL THEN SELECT * INTO pay FROM public.payments WHERE project_id=inv.project_id AND reference_number=p_reference_number LIMIT 1; IF FOUND THEN RETURN pay; END IF; END IF;
IF p_amount>COALESCE(inv.balance,0) THEN RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE'; END IF;
new_paid:=COALESCE(inv.amount_paid,0)+p_amount; new_balance:=GREATEST(COALESCE(inv.grand_total,0)-new_paid,0); new_status:=CASE WHEN new_balance=0 THEN 'paid' ELSE 'partial' END;
INSERT INTO public.payments(project_id,invoice_id,customer_id,receipt_number,amount,payment_method,collector_name,reference_number,notes) VALUES(inv.project_id,inv.id,inv.customer_id,public.next_seq_number('RCP'),p_amount,COALESCE(NULLIF(p_payment_method,''),'cash'),NULL,p_reference_number,p_notes) RETURNING * INTO pay;
UPDATE public.invoices SET amount_paid=new_paid,balance=new_balance,status=new_status,updated_at=now() WHERE id=inv.id; RETURN pay;
EXCEPTION WHEN unique_violation THEN
IF p_reference_number IS NOT NULL THEN SELECT * INTO pay FROM public.payments WHERE project_id=inv.project_id AND reference_number=p_reference_number LIMIT 1; IF FOUND THEN RETURN pay; END IF; END IF;
RAISE;
END; $function$;

CREATE OR REPLACE FUNCTION public.mrx_capture_meter_reading(p_meter_id uuid, p_reading_value numeric, p_reading_date timestamptz DEFAULT NULL, p_reading_method text DEFAULT 'photo', p_image_url text DEFAULT NULL, p_gps_lat numeric DEFAULT NULL, p_gps_lng numeric DEFAULT NULL, p_gps_accuracy numeric DEFAULT NULL, p_ai_extracted_value numeric DEFAULT NULL, p_ai_confidence numeric DEFAULT NULL, p_ai_model text DEFAULT NULL, p_notes text DEFAULT NULL, p_client_capture_id uuid DEFAULT NULL, p_detected_meter_number text DEFAULT NULL)
RETURNS public.meter_readings
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_meter public.meters%ROWTYPE; v_previous numeric; v_reading_date timestamptz; v_project_id uuid; v_customer_id uuid; v_reading public.meter_readings%ROWTYPE; v_expected_meter text; v_detected_meter text;
BEGIN
IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
IF p_reading_value IS NULL OR p_reading_value < 0 THEN RAISE EXCEPTION 'INVALID_READING_VALUE'; END IF;
SELECT * INTO v_meter FROM public.meters WHERE id = p_meter_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'METER_NOT_FOUND'; END IF;
v_project_id := v_meter.project_id; v_customer_id := v_meter.customer_id;
v_expected_meter := lower(regexp_replace(coalesce(v_meter.meter_number, ''), '[^a-zA-Z0-9]+', '', 'g')); v_detected_meter := lower(regexp_replace(coalesce(p_detected_meter_number, ''), '[^a-zA-Z0-9]+', '', 'g'));
IF NOT private.mizan_has_permission('meter.capture') OR NOT private.mizan_can_write_project(v_project_id,'meter_readings','insert') THEN RAISE EXCEPTION 'METER_CAPTURE_FORBIDDEN'; END IF;
IF v_meter.status <> 'active' THEN RAISE EXCEPTION 'METER_NOT_ACTIVE'; END IF;
IF p_client_capture_id IS NOT NULL THEN SELECT * INTO v_reading FROM public.meter_readings WHERE client_capture_id = p_client_capture_id AND meter_id = p_meter_id LIMIT 1; IF FOUND THEN RETURN v_reading; END IF; END IF;
v_reading_date := coalesce(p_reading_date, now());
SELECT mr.reading_value INTO v_previous FROM public.meter_readings mr WHERE mr.meter_id = p_meter_id AND mr.status NOT IN ('void', 'exception') ORDER BY mr.reading_date DESC, mr.created_at DESC LIMIT 1;
v_previous := coalesce(v_previous, v_meter.last_reading, 0);
IF p_reading_value < v_previous THEN RAISE EXCEPTION 'READING_DECREASE_REQUIRES_EXCEPTION'; END IF;
IF p_ai_confidence IS NOT NULL AND (p_ai_confidence < 0 OR p_ai_confidence > 100) THEN RAISE EXCEPTION 'INVALID_AI_CONFIDENCE'; END IF;
IF lower(coalesce(p_reading_method, '')) = 'photo' THEN
IF p_image_url IS NULL OR p_ai_extracted_value IS NULL OR p_ai_confidence IS NULL OR p_ai_model IS NULL THEN RAISE EXCEPTION 'PHOTO_OCR_REQUIRED'; END IF;
IF p_ai_confidence < 70 THEN RAISE EXCEPTION 'OCR_CONFIDENCE_TOO_LOW'; END IF;
IF abs(p_reading_value - p_ai_extracted_value) > 0.01 THEN RAISE EXCEPTION 'READING_MUST_MATCH_OCR'; END IF;
IF v_expected_meter = '' OR v_detected_meter = '' OR v_expected_meter <> v_detected_meter THEN RAISE EXCEPTION 'METER_IDENTITY_MISMATCH'; END IF;
ELSIF lower(coalesce(p_reading_method, '')) = 'manual_exception' THEN
IF NOT private.mizan_has_permission('meter.exception') THEN RAISE EXCEPTION 'METER_EXCEPTION_FORBIDDEN'; END IF;
IF NULLIF(trim(coalesce(p_notes, '')), '') IS NULL THEN RAISE EXCEPTION 'EXCEPTION_REASON_REQUIRED'; END IF;
ELSE RAISE EXCEPTION 'INVALID_READING_METHOD'; END IF;
INSERT INTO public.meter_readings(meter_id,project_id,customer_id,reading_value,previous_reading,consumption,reading_date,reading_method,image_url,ai_extracted_value,ai_confidence,ai_model,ai_detected_meter_number,status,anomaly_flag,anomaly_reason,gps_lat,gps_lng,gps_accuracy,sync_status,reader_name,notes,client_capture_id)
VALUES(p_meter_id,v_project_id,v_customer_id,p_reading_value,v_previous,p_reading_value-v_previous,v_reading_date,coalesce(nullif(p_reading_method,''),'photo'),p_image_url,p_ai_extracted_value,p_ai_confidence,p_ai_model,p_detected_meter_number,'approved',false,NULL,p_gps_lat,p_gps_lng,p_gps_accuracy,'synced',NULL,p_notes,p_client_capture_id) RETURNING * INTO v_reading;
UPDATE public.meters SET last_reading=p_reading_value,last_reading_date=v_reading_date,updated_at=now() WHERE id=p_meter_id;
INSERT INTO public.audit_logs(table_name,record_id,action,user_id,actor_user_id,project_id,entity_type,entity_id,reason,result,before_data,after_data)
VALUES('meter_readings',v_reading.id,'MRX_CAPTURE',(SELECT auth.uid()),(SELECT auth.uid()),v_project_id,'meter_reading',v_reading.id,CASE WHEN lower(coalesce(p_reading_method,''))='manual_exception' THEN p_notes ELSE NULL END,'accepted',jsonb_build_object('previous_reading',v_previous,'client_capture_id',p_client_capture_id),jsonb_build_object('reading_value',p_reading_value,'reading_method',p_reading_method,'reading_date',v_reading_date,'ai_confidence',p_ai_confidence,'ai_model',p_ai_model,'detected_meter_number',p_detected_meter_number,'gps_lat',p_gps_lat,'gps_lng',p_gps_lng,'gps_accuracy',p_gps_accuracy,'client_capture_id',p_client_capture_id));
RETURN v_reading;
END; $function$;