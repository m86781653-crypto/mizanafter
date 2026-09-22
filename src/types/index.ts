export interface Region {
  id: string;
  name_ar: string;
  name_en: string | null;
  code: string | null;
}

export interface District {
  id: string;
  region_id: string | null;
  name_ar: string;
  name_en: string | null;
  code: string | null;
}

export interface Organization {
  id: string;
  name_ar: string;
  name_en: string | null;
  type: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface Project {
  id: string;
  name_ar: string;
  name_en: string | null;
  organization_id: string | null;
  district_id: string | null;
  status: string;
  funding_source: string | null;
  donor: string | null;
  beneficiary_count: number;
  design_capacity: number;
  operational_capacity: number;
  address: string | null;
  established_date: string | null;
  location: string | null;
  created_at: string;
}

export interface Well {
  id: string;
  project_id: string;
  code: string;
  name_ar: string | null;
  depth_m: number | null;
  status: string;
  water_source: string | null;
  capacity_m3_h: number | null;
  daily_output_m3: number;
  operating_hours: number;
  pump_installed: boolean;
  water_level_m: number | null;
  location: string | null;
  installation_date: string | null;
  notes: string | null;
}

export interface Pump {
  id: string;
  project_id: string;
  well_id: string | null;
  code: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  power_kw: number | null;
  flow_rate_m3_h: number | null;
  head_m: number | null;
  status: string;
  operating_hours: number;
  efficiency: number | null;
  installation_date: string | null;
  notes: string | null;
}

export interface Tank {
  id: string;
  project_id: string;
  code: string;
  name_ar: string | null;
  capacity_m3: number | null;
  current_level_m3: number | null;
  material: string | null;
  elevation_m: number | null;
  status: string;
  installation_date: string | null;
}

export interface Customer {
  id: string;
  project_id: string;
  customer_number: string;
  name_ar: string;
  phone: string | null;
  address: string | null;
  customer_type: string;
  status: string;
  connection_date: string | null;
  notes: string | null;
  location: string | null;
}

export interface Meter {
  id: string;
  project_id: string;
  customer_id: string | null;
  meter_number: string;
  serial_number: string | null;
  meter_type: string;
  size_mm: number | null;
  status: string;
  installation_date: string | null;
  last_reading: number;
  last_reading_date: string | null;
  location: string | null;
}

export interface MeterReading {
  id: string;
  meter_id: string;
  project_id: string;
  customer_id: string | null;
  reading_value: number;
  previous_reading: number;
  consumption: number;
  reading_date: string;
  reading_method: string;
  image_url: string | null;
  ai_extracted_value: number | null;
  ai_confidence: number | null;
  ai_model: string | null;
  status: string;
  anomaly_flag: boolean;
  anomaly_reason: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy: number | null;
  sync_status: string;
  reader_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface Tariff {
  id: string;
  project_id: string | null;
  name_ar: string;
  customer_type: string;
  fixed_fee: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  version: number;
}

export interface TariffTier {
  id: string;
  tariff_id: string;
  from_m3: number;
  to_m3: number | null;
  price_per_m3: number;
}

export interface Invoice {
  id: string;
  project_id: string;
  customer_id: string;
  meter_id: string | null;
  invoice_number: string;
  billing_period_start: string;
  billing_period_end: string;
  previous_reading: number;
  current_reading: number;
  consumption_m3: number;
  fixed_fee: number;
  consumption_fee: number;
  total_amount: number;
  previous_balance: number;
  grand_total: number;
  amount_paid: number;
  balance: number;
  status: string;
  issue_date: string;
  due_date: string | null;
  notes: string | null;
  customers?: Customer;
}

export interface Payment {
  id: string;
  project_id: string;
  invoice_id: string | null;
  customer_id: string | null;
  receipt_number: string;
  amount: number;
  payment_method: string;
  collector_name: string | null;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  invoices?: Invoice;
  customers?: Customer;
}

export interface Asset {
  id: string;
  project_id: string;
  asset_code: string;
  name_ar: string;
  category: string | null;
  type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  status: string;
  purchase_date: string | null;
  purchase_cost: number | null;
  expected_lifespan_years: number | null;
  installation_date: string | null;
  notes: string | null;
}

export interface Fault {
  id: string;
  project_id: string;
  fault_number: string;
  asset_id: string | null;
  well_id: string | null;
  pump_id: string | null;
  reported_by: string | null;
  reporter_type: string;
  fault_type: string | null;
  severity: string;
  status: string;
  description: string | null;
  reported_at: string;
  verified_at: string | null;
  resolved_at: string | null;
  assigned_team: string | null;
  resolution_notes: string | null;
}

export interface WorkOrder {
  id: string;
  project_id: string;
  work_order_number: string;
  asset_id: string | null;
  well_id: string | null;
  pump_id: string | null;
  fault_id: string | null;
  type: string;
  priority: string;
  status: string;
  description: string | null;
  assigned_to: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  downtime_hours: number | null;
  parts_used: string | null;
  cost: number;
  notes: string | null;
  faults?: Fault;
}

export interface FieldTask {
  id: string;
  project_id: string;
  task_number: string;
  task_type: string;
  assigned_to: string | null;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  items_total: number;
  items_completed: number;
  notes: string | null;
}

export interface Notification {
  id: string;
  project_id: string | null;
  type: string;
  title_ar: string;
  body_ar: string | null;
  severity: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_id: string | null;
  user_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  reason: string | null;
  created_at: string;
}

export interface AiLog {
  id: string;
  operation: string;
  model: string | null;
  prompt_version: string | null;
  input_summary: string | null;
  output_summary: string | null;
  confidence: number | null;
  duration_ms: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface KpiSnapshot {
  id: string;
  project_id: string | null;
  period: string;
  period_start: string | null;
  period_end: string | null;
  water_production_m3: number | null;
  water_consumption_m3: number | null;
  nrw_percentage: number | null;
  revenue_total: number | null;
  revenue_collected: number | null;
  outstanding_balance: number | null;
  collection_rate: number | null;
  active_customers: number | null;
  total_readings: number | null;
  pending_readings: number | null;
  open_faults: number | null;
  open_work_orders: number | null;
  data_completeness: number | null;
}
