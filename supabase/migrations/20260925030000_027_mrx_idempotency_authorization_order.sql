-- MRX production idempotency and authorization ordering
-- Fixes two issues in the 026-era contract:
-- 1) client_capture_id was checked before project authorization, allowing an
--    authenticated caller who guessed an existing capture UUID to receive data.
-- 2) the early check was outside the meter row lock, so concurrent offline
--    retries could race and hit the unique index instead of returning the
--    existing capture.
--
-- The meter lock now establishes the serialization point, authorization is
-- completed first, and idempotency is checked only after the caller is
-- authorized for the meter's project.

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
  p_notes text DEFAULT NULL,
  p_client_capture_id uuid DEFAULT NULL,
  p_detected_meter_number text DEFAULT NULL
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
  v_expected_meter text;
  v_detected_meter text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_reading_value IS NULL OR p_reading_value < 0 THEN RAISE EXCEPTION 'INVALID_READING_VALUE'; END IF;

  -- Serialize captures for the same meter before evaluating idempotency or
  -- the previous reading. This makes offline retries deterministic.
  SELECT * INTO v_meter
  FROM public.meters
  WHERE id = p_meter_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'METER_NOT_FOUND'; END IF;

  v_project_id := v_meter.project_id;
  v_customer_id := v_meter.customer_id;
  v_expected_meter := lower(regexp_replace(coalesce(v_meter.meter_number, ''), '[^a-zA-Z0-9]+', '', 'g'));
  v_detected_meter := lower(regexp_replace(coalesce(p_detected_meter_number, ''), '[^a-zA-Z0-9]+', '', 'g'));

  IF NOT private.mizan_has_permission('meter.capture')
     OR NOT private.mizan_can_access_project(v_project_id) THEN
    RAISE EXCEPTION 'METER_CAPTURE_FORBIDDEN';
  END IF;
  IF v_meter.status <> 'active' THEN RAISE EXCEPTION 'METER_NOT_ACTIVE'; END IF;

  -- Idempotency is deliberately after authorization and the meter lock.
  IF p_client_capture_id IS NOT NULL THEN
    SELECT * INTO v_reading
    FROM public.meter_readings
    WHERE client_capture_id = p_client_capture_id
      AND meter_id = p_meter_id
    LIMIT 1;
    IF FOUND THEN RETURN v_reading; END IF;
  END IF;

  v_reading_date := coalesce(p_reading_date, now());

  SELECT mr.reading_value INTO v_previous
  FROM public.meter_readings mr
  WHERE mr.meter_id = p_meter_id AND mr.status NOT IN ('void', 'exception')
  ORDER BY mr.reading_date DESC, mr.created_at DESC
  LIMIT 1;
  v_previous := coalesce(v_previous, v_meter.last_reading, 0);
  IF p_reading_value < v_previous THEN RAISE EXCEPTION 'READING_DECREASE_REQUIRES_EXCEPTION'; END IF;

  IF p_ai_confidence IS NOT NULL AND (p_ai_confidence < 0 OR p_ai_confidence > 100) THEN
    RAISE EXCEPTION 'INVALID_AI_CONFIDENCE';
  END IF;

  IF lower(coalesce(p_reading_method, '')) = 'photo' THEN
    IF p_image_url IS NULL OR p_ai_extracted_value IS NULL OR p_ai_confidence IS NULL OR p_ai_model IS NULL THEN
      RAISE EXCEPTION 'PHOTO_OCR_REQUIRED';
    END IF;
    IF p_ai_confidence < 70 THEN RAISE EXCEPTION 'OCR_CONFIDENCE_TOO_LOW'; END IF;
    IF abs(p_reading_value - p_ai_extracted_value) > 0.01 THEN RAISE EXCEPTION 'READING_MUST_MATCH_OCR'; END IF;
    IF v_expected_meter = '' OR v_detected_meter = '' OR v_expected_meter <> v_detected_meter THEN
      RAISE EXCEPTION 'METER_IDENTITY_MISMATCH';
    END IF;
  ELSIF lower(coalesce(p_reading_method, '')) = 'manual_exception' THEN
    IF NOT private.mizan_has_permission('meter.exception') THEN RAISE EXCEPTION 'METER_EXCEPTION_FORBIDDEN'; END IF;
    IF NULLIF(trim(coalesce(p_notes, '')), '') IS NULL THEN RAISE EXCEPTION 'EXCEPTION_REASON_REQUIRED'; END IF;
  ELSE
    RAISE EXCEPTION 'INVALID_READING_METHOD';
  END IF;

  INSERT INTO public.meter_readings (
    meter_id, project_id, customer_id, reading_value, previous_reading, consumption,
    reading_date, reading_method, image_url, ai_extracted_value, ai_confidence, ai_model,
    ai_detected_meter_number, status, anomaly_flag, anomaly_reason,
    gps_lat, gps_lng, gps_accuracy, sync_status, reader_name, notes, client_capture_id
  )
  VALUES (
    p_meter_id, v_project_id, v_customer_id, p_reading_value, v_previous,
    p_reading_value - v_previous, v_reading_date, coalesce(nullif(p_reading_method, ''), 'photo'),
    p_image_url, p_ai_extracted_value, p_ai_confidence, p_ai_model, p_detected_meter_number,
    'approved', false, NULL, p_gps_lat, p_gps_lng, p_gps_accuracy, 'synced', NULL, p_notes,
    p_client_capture_id
  )
  RETURNING * INTO v_reading;

  UPDATE public.meters
  SET last_reading = p_reading_value, last_reading_date = v_reading_date, updated_at = now()
  WHERE id = p_meter_id;

  RETURN v_reading;
END;
$$;

REVOKE ALL ON FUNCTION public.mrx_capture_meter_reading(
  uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric, text, text, uuid, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mrx_capture_meter_reading(
  uuid, numeric, timestamptz, text, text, numeric, numeric, numeric, numeric, numeric, text, text, uuid, text
) TO authenticated;
