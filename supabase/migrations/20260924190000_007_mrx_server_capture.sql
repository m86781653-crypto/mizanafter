/*
# MIZAN Meter Reading Automation Engine (MRX) — server capture boundary

This migration extends the existing meter_readings/meters tables.
It does not create a replacement reading system.

The RPC:
- derives meter/customer/project identity from the meter master record
- derives previous reading on the server
- captures the business timestamp server-side when omitted
- locks the meter to make capture idempotent under concurrent requests
- validates tenant/project authorization through the existing production
  authorization layer
- relies on the existing database reading invariants and duplicate guard
- updates the existing meter snapshot only after the reading is committed
- returns the committed reading
*/

CREATE OR REPLACE FUNCTION public.mrx_capture_meter_reading(
  p_meter_id uuid,
  p_reading_value numeric,
  p_reading_date timestamptz DEFAULT NULL,
  p_reading_method text DEFAULT 'photo',
  p_image_url text DEFAULT NULL,
  p_gps_lat numeric DEFAULT NULL,
  p_gps_lng numeric DEFAULT NULL,
  p_gps_accuracy numeric DEFAULT NULL,
  p_ai_extracted_value numeric DEFAULT NULL,
  p_ai_confidence numeric DEFAULT NULL,
  p_ai_model text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.meter_readings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meter public.meters%ROWTYPE;
  v_previous numeric;
  v_reading_date timestamptz;
  v_project_id uuid;
  v_customer_id uuid;
  v_reading public.meter_readings%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF p_reading_value IS NULL OR p_reading_value < 0 THEN
    RAISE EXCEPTION 'INVALID_READING_VALUE';
  END IF;

  SELECT *
  INTO v_meter
  FROM public.meters
  WHERE id = p_meter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'METER_NOT_FOUND';
  END IF;

  v_project_id := v_meter.project_id;
  v_customer_id := v_meter.customer_id;

  IF NOT private.mizan_has_permission('meter.capture')
     OR NOT private.mizan_can_access_project(v_project_id) THEN
    RAISE EXCEPTION 'METER_CAPTURE_FORBIDDEN';
  END IF;

  IF v_meter.status <> 'active' THEN
    RAISE EXCEPTION 'METER_NOT_ACTIVE';
  END IF;

  v_reading_date := COALESCE(p_reading_date, now());

  SELECT mr.reading_value
  INTO v_previous
  FROM public.meter_readings mr
  WHERE mr.meter_id = p_meter_id
    AND mr.status NOT IN ('void', 'exception')
  ORDER BY mr.reading_date DESC, mr.created_at DESC
  LIMIT 1;

  v_previous := COALESCE(v_previous, v_meter.last_reading, 0);

  IF p_reading_value < v_previous THEN
    RAISE EXCEPTION 'READING_DECREASE_REQUIRES_EXCEPTION';
  END IF;

  IF p_ai_confidence IS NOT NULL
     AND (p_ai_confidence < 0 OR p_ai_confidence > 100) THEN
    RAISE EXCEPTION 'INVALID_AI_CONFIDENCE';
  END IF;

  INSERT INTO public.meter_readings (
    meter_id,
    project_id,
    customer_id,
    reading_value,
    previous_reading,
    consumption,
    reading_date,
    reading_method,
    image_url,
    ai_extracted_value,
    ai_confidence,
    ai_model,
    status,
    anomaly_flag,
    anomaly_reason,
    gps_lat,
    gps_lng,
    gps_accuracy,
    sync_status,
    reader_name,
    notes
  )
  VALUES (
    p_meter_id,
    v_project_id,
    v_customer_id,
    p_reading_value,
    v_previous,
    p_reading_value - v_previous,
    v_reading_date,
    COALESCE(NULLIF(p_reading_method, ''), 'photo'),
    p_image_url,
    p_ai_extracted_value,
    p_ai_confidence,
    p_ai_model,
    'approved',
    false,
    NULL,
    p_gps_lat,
    p_gps_lng,
    p_gps_accuracy,
    'synced',
    NULL,
    p_notes
  )
  RETURNING * INTO v_reading;

  UPDATE public.meters
  SET last_reading = p_reading_value,
      last_reading_date = v_reading_date,
      updated_at = now()
  WHERE id = p_meter_id;

  RETURN v_reading;
END;
$$;

REVOKE ALL ON FUNCTION public.mrx_capture_meter_reading(
  uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mrx_capture_meter_reading(
  uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric, text, text
) TO authenticated;

COMMENT ON FUNCTION public.mrx_capture_meter_reading IS
  'MRX server-authoritative meter capture. Identity, previous reading, consumption and authorization are resolved server-side.';
