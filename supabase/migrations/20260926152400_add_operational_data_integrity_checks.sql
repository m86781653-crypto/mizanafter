-- Permanent database invariants for core operational measurements and billing.
-- These checks are intentionally NULL-tolerant where the source field is optional.

ALTER TABLE public.meter_readings
  ADD CONSTRAINT meter_readings_reading_value_nonnegative CHECK (reading_value IS NULL OR reading_value >= 0),
  ADD CONSTRAINT meter_readings_consumption_nonnegative CHECK (consumption IS NULL OR consumption >= 0),
  ADD CONSTRAINT meter_readings_ai_confidence_range CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 100)),
  ADD CONSTRAINT meter_readings_gps_accuracy_nonnegative CHECK (gps_accuracy IS NULL OR gps_accuracy >= 0);

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_total_amount_nonnegative CHECK (total_amount IS NULL OR total_amount >= 0),
  ADD CONSTRAINT invoices_grand_total_nonnegative CHECK (grand_total IS NULL OR grand_total >= 0),
  ADD CONSTRAINT invoices_amount_paid_nonnegative CHECK (amount_paid IS NULL OR amount_paid >= 0),
  ADD CONSTRAINT invoices_balance_nonnegative CHECK (balance IS NULL OR balance >= 0),
  ADD CONSTRAINT invoices_consumption_m3_nonnegative CHECK (consumption_m3 IS NULL OR consumption_m3 >= 0);

ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

ALTER TABLE public.field_tasks
  ADD CONSTRAINT field_tasks_items_total_nonnegative CHECK (items_total IS NULL OR items_total >= 0),
  ADD CONSTRAINT field_tasks_items_completed_nonnegative CHECK (items_completed IS NULL OR items_completed >= 0),
  ADD CONSTRAINT field_tasks_items_completed_lte_total CHECK (
    items_completed IS NULL OR items_total IS NULL OR items_completed <= items_total
  );

ALTER TABLE public.wells
  ADD CONSTRAINT wells_depth_nonnegative CHECK (depth_m IS NULL OR depth_m >= 0),
  ADD CONSTRAINT wells_capacity_nonnegative CHECK (capacity_m3_h IS NULL OR capacity_m3_h >= 0),
  ADD CONSTRAINT wells_daily_output_nonnegative CHECK (daily_output_m3 IS NULL OR daily_output_m3 >= 0),
  ADD CONSTRAINT wells_operating_hours_range CHECK (operating_hours IS NULL OR (operating_hours >= 0 AND operating_hours <= 24)),
  ADD CONSTRAINT wells_water_level_nonnegative CHECK (water_level_m IS NULL OR water_level_m >= 0);

ALTER TABLE public.pumps
  ADD CONSTRAINT pumps_power_nonnegative CHECK (power_kw IS NULL OR power_kw >= 0),
  ADD CONSTRAINT pumps_flow_nonnegative CHECK (flow_rate_m3_h IS NULL OR flow_rate_m3_h >= 0),
  ADD CONSTRAINT pumps_head_nonnegative CHECK (head_m IS NULL OR head_m >= 0),
  ADD CONSTRAINT pumps_operating_hours_range CHECK (operating_hours IS NULL OR (operating_hours >= 0 AND operating_hours <= 24)),
  ADD CONSTRAINT pumps_efficiency_range CHECK (efficiency IS NULL OR (efficiency >= 0 AND efficiency <= 100));
