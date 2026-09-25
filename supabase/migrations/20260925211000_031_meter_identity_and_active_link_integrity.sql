CREATE UNIQUE INDEX IF NOT EXISTS ux_meters_project_meter_number
  ON public.meters(project_id, meter_number);

CREATE UNIQUE INDEX IF NOT EXISTS ux_meters_project_customer_active
  ON public.meters(project_id, customer_id)
  WHERE customer_id IS NOT NULL AND status = 'active';
