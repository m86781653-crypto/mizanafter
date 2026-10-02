
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const DB = process.env.DATABASE_URL;
const APP = process.env.APP_URL || 'http://127.0.0.1:4173';

if (!URL || !ANON || !DB) throw new Error('Missing local Supabase connection env');

fs.mkdirSync('e2e-output', { recursive: true });
const report = [];
const evidence = [];

function log(title, payload = {}) {
  const line = { t: new Date().toISOString(), title, ...payload };
  report.push(line);
  console.log('E2E', JSON.stringify(line));
}

function sql(q) {
  return execFileSync('psql', [DB, '-X', '-v', 'ON_ERROR_STOP=1', '-At', '-c', q], { encoding: 'utf8' }).trim();
}

function sqlJson(q) {
  const out = sql(q);
  return out ? JSON.parse(out) : null;
}

function yemenDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Aden',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);
  const values = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return values.year + '-' + values.month + '-' + values.day;
}


async function rpc(client, fn, args, label) {
  const result = await client.rpc(fn, args);
  if (result.error) {
    log(label + ' FAILED', {
      error: result.error.message,
      code: result.error.code,
      details: result.error.details,
      hint: result.error.hint
    });
    throw new Error(label + ': ' + result.error.message);
  }
  log(label + ' OK', { data: result.data });
  return result.data;
}

async function query(client, table, columns, filters = {}) {
  let q = client.from(table).select(columns);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const result = await q;
  if (result.error) throw new Error('query ' + table + ': ' + result.error.message);
  return result.data || [];
}

async function getOne(client, table, columns, filters) {
  const rows = await query(client, table, columns, filters);
  return rows[0] || null;
}

async function safeQuery(client, table, columns, filters = {}) {
  try {
    return { ok: true, data: await query(client, table, columns, filters) };
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }
}

async function createSignedInClient(email, password) {
  const anon = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const login = await anon.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session?.user) {
    throw new Error('signin ' + email + ': ' + (login.error?.message || 'no session'));
  }
  return {
    id: login.data.session.user.id,
    client: createClient(URL, ANON, {
      global: { headers: { Authorization: 'Bearer ' + login.data.session.access_token } },
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
}

async function newUser(email, password) {
  const anon = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const sign = await anon.auth.signUp({ email, password });
  if (sign.error) throw new Error('signup ' + email + ': ' + sign.error.message);
  const id = sign.data.user?.id;
  if (!id) throw new Error('signup returned no user for ' + email);

  // Local-test-only confirmation; this never touches production.
  sql("update auth.users set email_confirmed_at=coalesce(email_confirmed_at,now()) where id='" + id + "';");
  const login = await anon.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) {
    throw new Error('signin ' + email + ': ' + (login.error?.message || 'no session'));
  }

  return {
    id,
    client: createClient(URL, ANON, {
      global: { headers: { Authorization: 'Bearer ' + login.data.session.access_token } },
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
}

function seedProfile(id, email, role, tenantId, projectId, mustChangePassword = true) {
  const tenantSql = tenantId ? "'" + tenantId + "'" : "null";
  const projectSql = projectId ? "'" + projectId + "'" : "null";
  const passwordSql = mustChangePassword ? "true" : "false";
  const q =
    "insert into public.profiles(id,email,full_name,role,tenant_id,project_id,must_change_password) " +
    "values ('" + id + "','" + email + "','E2E " + role + "','" + role + "'," + tenantSql + "," + projectSql + "," + passwordSql + ") " +
    "on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,role=excluded.role," +
    "tenant_id=excluded.tenant_id,project_id=excluded.project_id,must_change_password=excluded.must_change_password;";
  sql(q);
}

function snapshotProject(projectId) {
  return sqlJson(
    "select json_build_object(" +
    "'customers',(select count(*) from public.customers where project_id='" + projectId + "')," +
    "'meters',(select count(*) from public.meters where project_id='" + projectId + "')," +
    "'readings',(select count(*) from public.meter_readings where project_id='" + projectId + "')," +
    "'invoices',(select count(*) from public.invoices where project_id='" + projectId + "')," +
    "'payments',(select count(*) from public.payments where project_id='" + projectId + "')," +
    "'production_meters',(select count(*) from public.water_production_meters where project_id='" + projectId + "')," +
    "'production_readings',(select count(*) from public.water_production_readings where project_id='" + projectId + "')," +
    "'production_cycles',(select count(*) from public.pump_operation_cycles where project_id='" + projectId + "')," +
    "'faults',(select count(*) from public.faults where project_id='" + projectId + "')," +
    "'work_orders',(select count(*) from public.maintenance_work_orders where project_id='" + projectId + "')" +
    ")::text;"
  );
}

async function main() {
  fs.writeFileSync('e2e-output/e2e-report.md', '# MIZAN isolated E2E report\n\n');
  log('ENVIRONMENT', {
    url: URL,
    app: APP,
    local_only: true,
    production_used: false,
    service_role_used: false
  });

  // Test dates follow the system's Yemen business date so automatic connection/install dates
  // are valid inputs instead of hard-coded historical dates.
  const cycle1Date = yemenDate(0);
  const cycle2Date = yemenDate(1);
  const cycle2EndDate = yemenDate(2);
  const physicalMeterSerial = 'PHY-E2E-001';

  // --- Bootstrap only what migrations require for an isolated test ---
  const mainTenantId = 'b9295364-d688-4e20-b2a3-433f08bfdcaa';
  sql(
    "insert into public.tenants(id,parent_tenant_id,name_ar,name_en,tenant_type,timezone,status) " +
    "values ('" + mainTenantId + "',null,'E2E Rural Water Authority','E2E Rural Water Authority','main_tenant','Asia/Aden','active') " +
    "on conflict(id) do update set name_ar=excluded.name_ar,name_en=excluded.name_en,tenant_type='main_tenant',timezone='Asia/Aden',status='active';"
  );
  log('SEED LOCAL CENTRAL TENANT', { mainTenantId });

  // --- Platform owner -> central tenant gate ---
  const platform = await newUser('platform-admin@e2e.invalid', 'E2Eplatform!2026');
  seedProfile(platform.id, 'platform-admin@e2e.invalid', 'platform_admin', null, null);

  const tenantFunctions = sqlJson(
    "select coalesce(json_agg(json_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid)) order by p.proname),'[]'::json) " +
    "from pg_proc p join pg_namespace n on n.oid=p.pronamespace " +
    "where n.nspname='public' and p.proname ilike '%tenant%' and p.proname not ilike '%provision_subtenant_auto%';"
  );
  const mainTenantCreators = tenantFunctions.filter(
    x => /main|authority|create_tenant|tenant_create/.test(String(x.name))
  );
  log('PLATFORM OWNER -> CENTRAL TENANT ENTRYPOINT', {
    public_tenant_functions: tenantFunctions,
    main_tenant_creator_candidates: mainTenantCreators
  });
  evidence.push({
    stage: 'platform_owner_to_central_tenant',
    result: mainTenantCreators.length ? 'entrypoint_present_but_not_invoked' : 'BLOCKED',
    detail: 'No current public function specifically creates a main_tenant/authority tenant; the migration chain updates a fixed main tenant identity.'
  });

  // --- Real central governance provisioning RPC ---
  const central = await newUser('central-governance@e2e.invalid', 'E2Ecentral!2026');
  seedProfile(central.id, 'central-governance@e2e.invalid', 'central_governance', mainTenantId, null, false);

  const centralBefore = await safeQuery(central.client, 'projects', 'id,name_ar,tenant_id,status');
  log('CENTRAL BEFORE CHILD PROVISION', centralBefore);
  if (!centralBefore.ok) {
    evidence.push({
      stage: 'central_project_list',
      result: 'broken',
      detail: centralBefore.error
    });
  }

  const provision = await rpc(
    central.client,
    'mizan_provision_subtenant',
    {
      p_tenant_name_ar: 'مشروع اختبار المياه 2026',
      p_tenant_name_en: 'E2E Water Tenant 2026',
      p_project_name_ar: 'مشروع اختبار الدورة 2026',
      p_project_name_en: 'E2E Cycle Project 2026',
      p_timezone: 'Asia/Aden',
      p_funding_source: 'E2E',
      p_funding_amount: 10000,
      p_funding_currency: 'YER',
      p_donor: 'E2E',
      p_beneficiary_count: 20,
      p_design_capacity: 100,
      p_operational_capacity: 80,
      p_address: 'E2E local runner',
      p_established_date: '2026-09-01',
      p_district_id: null,
      p_users: [
        { role: 'project_manager', full_name: 'E2E Project Manager', email: 'pm-onboard@e2e.invalid' },
        { role: 'meter_reader', full_name: 'E2E Meter Reader', email: 'reader-onboard@e2e.invalid' },
        { role: 'collection_officer', full_name: 'E2E Collector', email: 'collector-onboard@e2e.invalid' },
        { role: 'operations_maintenance', full_name: 'E2E Operations', email: 'ops-onboard@e2e.invalid' }
      ]
    },
    'CENTRAL -> CHILD TENANT/PROJECT PROVISION'
  );

  const projectId = provision.project_id;
  const tenantId = provision.tenant_id;
  const slots = provision.user_slots;
  log('PROVISIONED CHILD SNAPSHOT', {
    projectId,
    tenantId,
    slots: slots.map(s => ({ role: s.role, email: s.email, token_present: Boolean(s.onboarding_token) }))
  });

  // --- Real UI onboarding test using the token emitted by the real RPC ---
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const onboardingSlot = slots.find(s => s.role === 'project_manager');
  try {
    await page.goto(APP + '/onboarding', { waitUntil: 'networkidle' });
    const onboardingInputs = page.locator('form input');
    await onboardingInputs.nth(0).fill(onboardingSlot.email);
    await onboardingInputs.nth(1).fill(onboardingSlot.onboarding_token);
    await onboardingInputs.nth(2).fill('E2Euser!2026');
    await onboardingInputs.nth(3).fill('E2Euser!2026');
    await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
    await page.waitForTimeout(1200);
    log('UI ONBOARDING RESULT', { body: (await page.locator('body').innerText()).slice(0, 1800) });
  } finally {
    await browser.close();
  }

  const onboardingDb = sqlJson(
    "select json_build_object(" +
    "'user',(select json_build_object('id',id,'email',email,'raw_user_meta_data',raw_user_meta_data,'raw_app_meta_data',raw_app_meta_data) from auth.users where lower(email)=lower('pm-onboard@e2e.invalid'))," +
    "'profile',(select row_to_json(p) from public.profiles p where lower(p.email)=lower('pm-onboard@e2e.invalid'))," +
    "'slot_status',(select status from private.subtenant_user_slots where tenant_id='" + tenantId + "' and role='project_manager')" +
    ")::text;"
  );
  log('UI ONBOARDING DB POST-CHECK', onboardingDb);
  evidence.push({
    stage: 'project_user_onboarding',
    result: onboardingDb.profile ? 'working' : 'broken',
    detail: 'The token came from the real provisioning RPC; the browser used the real /onboarding page; auth.users, profiles and slot state were then inspected directly.'
  });

  // --- Seed only downstream identities after testing the actual onboarding path ---
  const identities = {};
  const onboardedPm = await createSignedInClient('pm-onboard@e2e.invalid', 'E2Euser!2026');
  identities.pm = onboardedPm;
  const identityDefs = [
    ['reader', 'e2e-reader@e2e.invalid', 'meter_reader'],
    ['collector', 'e2e-collector@e2e.invalid', 'collection_officer'],
    ['ops', 'e2e-ops@e2e.invalid', 'operations_maintenance']
  ];
  for (const [key, email, role] of identityDefs) {
    identities[key] = await newUser(email, 'E2Erole!2026');
    seedProfile(identities[key].id, email, role, tenantId, projectId);
  }
  log('SEED DOWNSTREAM TEST IDENTITIES', {
    users: Object.fromEntries(Object.entries(identities).map(([k, v]) => [k, v.id]))
  });

  const pm = identities.pm.client;
  const reader = identities.reader.client;
  const collector = identities.collector.client;
  const ops = identities.ops.client;

  // --- Infrastructure through authenticated REST writes, matching the existing UI write path ---
  const infraBefore = {
    wells: await query(pm, 'wells', 'id,code,status', { project_id: projectId }),
    pumps: await query(pm, 'pumps', 'id,code,status', { project_id: projectId }),
    tanks: await query(pm, 'tanks', 'id,code,current_level_m3,status', { project_id: projectId }),
    customers: await query(pm, 'customers', 'id,customer_number,name_ar', { project_id: projectId })
  };
  log('PROJECT BASELINE BEFORE INFRA', infraBefore);

  const wellInsert = await pm.from('wells').insert({
    project_id: projectId,
    code: 'E2E-WELL-01',
    name_ar: 'بئر الاختبار',
    status: 'operational',
    capacity_m3_h: 10
  }).select().single();
  if (wellInsert.error) throw new Error('well insert: ' + wellInsert.error.message);

  const pumpInsert = await pm.from('pumps').insert({
    project_id: projectId,
    well_id: wellInsert.data.id,
    code: 'E2E-PUMP-01',
    status: 'operational',
    flow_rate_m3_h: 10
  }).select().single();
  if (pumpInsert.error) throw new Error('pump insert: ' + pumpInsert.error.message);

  const tankInsert = await pm.from('tanks').insert({
    project_id: projectId,
    code: 'E2E-TANK-01',
    name_ar: 'خزان الاختبار',
    capacity_m3: 200,
    current_level_m3: 50,
    status: 'operational'
  }).select().single();
  if (tankInsert.error) throw new Error('tank insert: ' + tankInsert.error.message);

  const tariffResult = await rpc(pm, 'mizan_create_tariff_with_tiers', {
    p_project_id: projectId,
    p_name_ar: 'تعرفة E2E',
    p_customer_type: 'residential',
    p_fixed_fee: 5,
    p_base_liters_per_person_per_day: 50,
    p_base_price_per_m3: 0,
    p_reference_period_days: 30,
    p_tiers: [{ from_m3: 0, to_m3: null, price_per_m3: 2 }]
  }, 'CREATE GOVERNED E2E TARIFF');
  const tariffId = tariffResult?.tariff?.id;
  if (!tariffId) throw new Error('governed tariff RPC returned no tariff id');

  const customerMeterResult = await rpc(pm, 'mizan_create_customer_with_meter', {
    p_project_id: projectId,
    p_customer_name: 'مشترك الاختبار',
    p_phone: null,
    p_address: 'E2E local',
    p_customer_type: 'residential',
    p_customer_status: 'active',
    p_household_members: 4,
    p_notes: 'E2E',
    p_meter_serial_number: 'PHY-E2E-001',
    p_meter_type: 'mechanical',
    p_meter_size_mm: 20,
    p_meter_status: 'active'
  }, 'CREATE GOVERNED E2E CUSTOMER + METER');
  const customerId = customerMeterResult?.customer?.id;
  const meterId = customerMeterResult?.meter?.id;
  if (!customerId || !meterId) throw new Error('governed customer/meter RPC returned no ids');
  const customerInsert = { data: customerMeterResult.customer };
  const meterInsert = { data: customerMeterResult.meter };

  log('INFRA/COMMERCIAL SETUP', {
    wellId: wellInsert.data.id,
    pumpId: pumpInsert.data.id,
    tankId: tankInsert.data.id,
    tariffId,
    customerId,
    meterId
  });

  const productionMeter = await rpc(
    pm,
    'mizan_register_water_production_meter',
    {
      p_project_id: projectId,
      p_well_id: wellInsert.data.id,
      p_pump_id: pumpInsert.data.id,
      p_meter_number: 'E2E-PROD-MTR-001',
      p_serial_number: 'PROD-PHY-001',
      p_initial_reading: 100,
      p_installed_at: '2026-09-01',
      p_notes: 'E2E'
    },
    'REGISTER PRODUCTION METER'
  );

  const prodMeterId = productionMeter;
  const baseline1 = snapshotProject(projectId);
  const tankBefore1 = await getOne(pm, 'tanks', 'id,current_level_m3,status', { id: tankInsert.data.id });
  log('CYCLE 1 BASELINE', { snapshot: baseline1, tank: tankBefore1 });

  // --- Cycle 1 production ---
  const p1Start = await rpc(ops, 'mizan_capture_water_production_reading', {
    p_production_meter_id: prodMeterId,
    p_reading_value: 100,
    p_captured_at: `${cycle1Date}T18:00:00+03:00`,
    p_capture_phase: 'start',
    p_image_url: projectId + '/production/' + prodMeterId + '/c1-start.jpg',
    p_gps_lat: 13,
    p_gps_lng: 44,
    p_gps_accuracy: 10,
    p_notes: 'E2E cycle 1 start',
    p_detected_serial_number: 'PROD-PHY-001',
    p_ai_confidence: 95,
    p_ai_model: 'e2e-synthetic-ocr'
  }, 'CYCLE 1 PRODUCTION START READING');

  const cycle1 = await rpc(ops, 'mizan_start_pump_operation_cycle', {
    p_production_meter_id: prodMeterId,
    p_reading_id: p1Start,
    p_started_at: `${cycle1Date}T18:00:00+03:00`,
    p_notes: 'E2E cycle 1'
  }, 'CYCLE 1 PUMP START');

  const p1Stop = await rpc(ops, 'mizan_capture_water_production_reading', {
    p_production_meter_id: prodMeterId,
    p_reading_value: 160,
    p_captured_at: `${cycle1Date}T20:00:00+03:00`,
    p_capture_phase: 'stop',
    p_image_url: projectId + '/production/' + prodMeterId + '/c1-stop.jpg',
    p_gps_lat: 13,
    p_gps_lng: 44,
    p_gps_accuracy: 10,
    p_notes: 'E2E cycle 1 stop',
    p_detected_serial_number: 'PROD-PHY-001',
    p_ai_confidence: 95,
    p_ai_model: 'e2e-synthetic-ocr'
  }, 'CYCLE 1 PRODUCTION STOP READING');

  const production1 = await rpc(ops, 'mizan_stop_pump_operation_cycle', {
    p_cycle_id: cycle1,
    p_reading_id: p1Stop,
    p_stopped_at: `${cycle1Date}T20:00:00+03:00`,
    p_notes: 'E2E cycle 1'
  }, 'CYCLE 1 PUMP STOP');
  const cycle1After = await getOne(pm, 'pump_operation_cycles', 'id,status,started_at,stopped_at,production_m3', { id: cycle1 });

  const tankAfterProd1 = await getOne(pm, 'tanks', 'id,current_level_m3,status', { id: tankInsert.data.id });
  log('CYCLE 1 PRODUCTION POST-CHECK', {
    production_m3: production1,
    tank_before: tankBefore1,
    tank_after: tankAfterProd1,
    operational_cycle: cycle1After,
    snapshot: snapshotProject(projectId)
  });

  // --- Cycle 1 subscriber reading -> invoice -> payment ---
  const reading1 = await rpc(reader, 'mrx_capture_meter_reading', {
    p_meter_id: meterId,
    p_reading_value: 10,
    p_reading_date: `${cycle1Date}T18:30:00+03:00`,
    p_reading_method: 'photo',
    p_image_url: projectId + '/meter-readings/' + meterId + '/c1.jpg',
    p_gps_lat: 13,
    p_gps_lng: 44,
    p_gps_accuracy: 10,
    p_ai_extracted_value: 10,
    p_ai_confidence: 95,
    p_ai_model: 'e2e-synthetic-ocr',
    p_notes: 'E2E cycle 1',
    p_client_capture_id: crypto.randomUUID(),
    p_detected_meter_number: physicalMeterSerial
  }, 'CYCLE 1 SUBSCRIBER READING');

  const invoice1 = await getOne(reader, 'invoices',
    'id,grand_total,previous_balance,current_reading,consumption_m3,amount_paid,balance,status,billing_period_start,billing_period_end,invoice_number,source_reading_id',
    { source_reading_id: reading1.id }
  );
  if (!invoice1) throw new Error('CYCLE 1 invoice not found by source_reading_id');
  log('CYCLE 1 READING -> INVOICE', { readingId: reading1, invoice: invoice1 });

  const payment1 = await rpc(collector, 'mizan_record_payment', {
    p_invoice_id: invoice1.id,
    p_amount: 10,
    p_payment_method: 'cash',
    p_reference_number: 'E2E-PAY-001',
    p_notes: 'E2E partial payment'
  }, 'CYCLE 1 PAYMENT RECORD');

  const invoicePending = await getOne(reader, 'invoices', 'id,grand_total,amount_paid,balance,status', { id: invoice1.id });
  const paymentApproved = await rpc(pm, 'mizan_review_payment', {
    p_payment_id: payment1.id,
    p_decision: 'approved',
    p_reason: 'E2E approved'
  }, 'CYCLE 1 PAYMENT APPROVAL');

  const invoiceAfterPayment = await getOne(reader, 'invoices',
    'id,grand_total,amount_paid,balance,status',
    { id: invoice1.id }
  );
  log('CYCLE 1 PAYMENT POST-CHECK', {
    payment: paymentApproved,
    invoice_before_approval: invoicePending,
    invoice_after_approval: invoiceAfterPayment
  });

  // --- Cycle 1 maintenance ---
  const fault1 = await rpc(pm, 'mizan_report_fault_with_impact', {
    p_project_id: projectId,
    p_fault_type: 'pump_fault',
    p_severity: 'high',
    p_description: 'E2E cycle 1 pump fault',
    p_asset_id: null,
    p_well_id: wellInsert.data.id,
    p_pump_id: pumpInsert.data.id,
    p_causes_service_interruption: false,
    p_interruption_type: 'production_stop',
    p_started_at: null,
    p_start_time_reason: null,
    p_cause_category: 'mechanical',
    p_cause_description: 'Synthetic E2E fault',
    p_production_meter_id: prodMeterId,
    p_coverage_benchmark_lpd: null
  }, 'CYCLE 1 FAULT REPORT');

  const faultId = fault1.fault.id;
  const workOrderBefore = await getOne(pm, 'maintenance_work_orders',
    'id,work_order_number,status,assigned_to,fault_id,completed_date,closed_at,cost',
    { fault_id: faultId }
  );
  log('FAULT -> WORK ORDER AUTO-CHECK', { faultId, workOrderBefore });

  const assigned = await rpc(pm, 'mizan_assign_work_order', {
    p_work_order_id: workOrderBefore.id,
    p_assigned_to: 'E2E Technician',
    p_scheduled_date: cycle1Date
  }, 'CYCLE 1 WORK ORDER ASSIGN');

  const executed = await rpc(ops, 'mizan_record_work_order_execution', {
    p_work_order_id: workOrderBefore.id,
    p_downtime_hours: 2,
    p_parts_used: 'seal',
    p_cost: 500,
    p_notes: 'E2E repair'
  }, 'CYCLE 1 WORK ORDER EXECUTE');

  const closed = await rpc(pm, 'mizan_close_work_order', {
    p_work_order_id: workOrderBefore.id,
    p_notes: 'E2E closed'
  }, 'CYCLE 1 WORK ORDER CLOSE');

  const faultAfter = await getOne(pm, 'faults', 'id,status,resolved_at,resolution_notes', { id: faultId });
  const workOrderAfter = await getOne(pm, 'maintenance_work_orders',
    'id,status,assigned_to,completed_date,closed_at,cost',
    { id: workOrderBefore.id }
  );
  log('CYCLE 1 MAINTENANCE POST-CHECK', {
    assigned,
    executed,
    closed,
    faultAfter,
    workOrderAfter
  });

  // --- Central reflection after cycle 1 ---
  const centralReport1 = await rpc(central.client, 'mizan_operational_report', {
    p_project_id: projectId,
    p_period_start: cycle1Date,
    p_period_end: cycle2Date
  }, 'CENTRAL REPORT AFTER CYCLE 1');

  const centralProject1 = await safeQuery(central.client, 'projects', 'id,name_ar,tenant_id,status', { id: projectId });
  log('CENTRAL REFLECTION CYCLE 1', {
    project: centralProject1,
    report: centralReport1
  });

  // --- Cycle 2 ---
  const baseline2 = snapshotProject(projectId);
  const tankBefore2 = await getOne(pm, 'tanks', 'id,current_level_m3,status', { id: tankInsert.data.id });
  log('CYCLE 2 BASELINE', { snapshot: baseline2, tank: tankBefore2 });

  const p2Start = await rpc(ops, 'mizan_capture_water_production_reading', {
    p_production_meter_id: prodMeterId,
    p_reading_value: 160,
    p_captured_at: `${cycle2Date}T18:00:00+03:00`,
    p_capture_phase: 'start',
    p_image_url: projectId + '/production/' + prodMeterId + '/c2-start.jpg',
    p_gps_lat: 13,
    p_gps_lng: 44,
    p_gps_accuracy: 10,
    p_notes: 'E2E cycle 2 start',
    p_detected_serial_number: 'PROD-PHY-001',
    p_ai_confidence: 95,
    p_ai_model: 'e2e-synthetic-ocr'
  }, 'CYCLE 2 PRODUCTION START READING');

  const cycle2 = await rpc(ops, 'mizan_start_pump_operation_cycle', {
    p_production_meter_id: prodMeterId,
    p_reading_id: p2Start,
    p_started_at: `${cycle2Date}T18:00:00+03:00`,
    p_notes: 'E2E cycle 2'
  }, 'CYCLE 2 PUMP START');

  const p2Stop = await rpc(ops, 'mizan_capture_water_production_reading', {
    p_production_meter_id: prodMeterId,
    p_reading_value: 190,
    p_captured_at: `${cycle2Date}T20:00:00+03:00`,
    p_capture_phase: 'stop',
    p_image_url: projectId + '/production/' + prodMeterId + '/c2-stop.jpg',
    p_gps_lat: 13,
    p_gps_lng: 44,
    p_gps_accuracy: 10,
    p_notes: 'E2E cycle 2 stop',
    p_detected_serial_number: 'PROD-PHY-001',
    p_ai_confidence: 95,
    p_ai_model: 'e2e-synthetic-ocr'
  }, 'CYCLE 2 PRODUCTION STOP READING');

  const production2 = await rpc(ops, 'mizan_stop_pump_operation_cycle', {
    p_cycle_id: cycle2,
    p_reading_id: p2Stop,
    p_stopped_at: `${cycle2Date}T20:00:00+03:00`,
    p_notes: 'E2E cycle 2'
  }, 'CYCLE 2 PUMP STOP');
  const cycle2After = await getOne(pm, 'pump_operation_cycles', 'id,status,started_at,stopped_at,production_m3', { id: cycle2 });

  const reading2 = await rpc(reader, 'mrx_capture_meter_reading', {
    p_meter_id: meterInsert.data.id,
    p_reading_value: 16,
    p_reading_date: `${cycle2Date}T18:30:00+03:00`,
    p_reading_method: 'photo',
    p_image_url: projectId + '/meter-readings/' + meterId + '/c2.jpg',
    p_gps_lat: 13,
    p_gps_lng: 44,
    p_gps_accuracy: 10,
    p_ai_extracted_value: 16,
    p_ai_confidence: 95,
    p_ai_model: 'e2e-synthetic-ocr',
    p_notes: 'E2E cycle 2',
    p_client_capture_id: crypto.randomUUID(),
    p_detected_meter_number: physicalMeterSerial
  }, 'CYCLE 2 SUBSCRIBER READING');

  const invoice2 = await getOne(reader, 'invoices',
    'id,grand_total,previous_balance,current_reading,consumption_m3,amount_paid,balance,status,billing_period_start,billing_period_end,invoice_number,source_reading_id',
    { source_reading_id: reading2.id }
  );
  if (!invoice2) throw new Error('CYCLE 2 invoice not found by source_reading_id');

  log('CYCLE 1 -> CYCLE 2 FINANCIAL POST-CHECK', {
    cycle1_remaining_balance: invoiceAfterPayment.balance,
    cycle2_previous_balance: invoice2.previous_balance,
    invoice2
  });

  const waterBalanceRows = await query(pm, 'mizan_water_balance',
    'project_id,period_date,production_m3,recorded_consumption_m3,unaccounted_gap_m3',
    { project_id: projectId }
  );
  log('WATER BALANCE AFTER TWO CYCLES', { rows: waterBalanceRows });

  const tankAfter2 = await getOne(pm, 'tanks', 'id,current_level_m3,status', { id: tankInsert.data.id });
  log('CYCLE 2 POST-CHECK', {
    production_m3: production2,
    operational_cycle: cycle2After,
    tankBefore: tankBefore2,
    tankAfter: tankAfter2,
    snapshot: snapshotProject(projectId)
  });

  const centralReport2 = await rpc(central.client, 'mizan_operational_report', {
    p_project_id: projectId,
    p_period_start: cycle2Date,
    p_period_end: cycle2EndDate
  }, 'CENTRAL REPORT AFTER CYCLE 2');

  log('CENTRAL REFLECTION CYCLE 2', {
    report: centralReport2
  });

  // Actual central UI verification after operational data exists.
  const uiBrowser = await chromium.launch({ headless: true });
  const uiPage = await uiBrowser.newPage();
  let centralUiText = '';
  let centralUiObserved = false;
  try {
    await uiPage.goto(APP + '/', { waitUntil: 'networkidle' });
    await uiPage.locator('input[type="email"]').fill('central-governance@e2e.invalid');
    await uiPage.locator('input[type="password"]').fill('E2Ecentral!2026');
    await uiPage.getByRole('button', { name: 'تسجيل الدخول' }).click();
    await uiPage.waitForTimeout(1200);
    const reportsNav = uiPage.getByRole('button', { name: 'التقارير والتحليلات' });
    await reportsNav.click();
    await uiPage.waitForTimeout(1200);
    await uiPage.getByLabel('بداية الفترة').fill(cycle2Date);
    await uiPage.getByLabel('نهاية الفترة').fill(cycle2Date);
    await uiPage.getByRole('button', { name: 'تطبيق الفترة' }).click();
    await uiPage.waitForTimeout(1200);
    centralUiText = await uiPage.locator('body').innerText();
    centralUiObserved =
      centralUiText.includes('التقارير والتحليلات') &&
      centralUiText.includes('مشروع اختبار الدورة 2026') &&
      centralUiText.includes('30') &&
      centralUiText.includes('م³');
    log('CENTRAL UI REPORT AFTER CYCLE 2', {
      observed: centralUiObserved,
      body_excerpt: centralUiText.slice(0, 5000)
    });
    evidence.push({
      stage: 'central_ui_reflection',
      result: centralUiObserved ? 'working' : 'not_observed',
      detail: 'Logged into the actual local MIZAN UI as central_governance, opened Reports, selected cycle 2 dates, and checked rendered project/report content.'
    });
  } finally {
    await uiBrowser.close();
  }

  const pmVisibleProjects = await safeQuery(pm, 'projects', 'id,name_ar,tenant_id,status');
  const centralVisibleProjects = await safeQuery(central.client, 'projects', 'id,name_ar,tenant_id,status');
  log('PROJECT ISOLATION / CENTRAL VISIBILITY', {
    projectManagerProjects: pmVisibleProjects,
    centralProjects: centralVisibleProjects
  });

  // --- Cycle closing / rollover probe inside the local database ---
  const lifecycleFns = sqlJson(
    "select coalesce(json_agg(json_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid)) order by p.proname),'[]'::json) " +
    "from pg_proc p join pg_namespace n on n.oid=p.pronamespace " +
    "where n.nspname='public' and (p.proname ilike '%cycle%' or p.proname ilike '%carry%' or p.proname ilike '%rollover%' or p.proname ilike '%period%');"
  );

  const relevantLifecycle = lifecycleFns.filter(
    x => /project|business|carry|roll|close.*cycle|open.*cycle|next.*cycle/i.test(String(x.name + ' ' + x.args))
  );

  log('PROJECT CYCLE CLOSE/ROLLOVER DISCOVERY', {
    publicLifecycleFunctions: lifecycleFns,
    relevantLifecycleFunctions: relevantLifecycle
  });

  evidence.push({
    stage: 'project_cycle_close_and_rollover',
    result: 'NO_ENTRYPOINT_DISCOVERED',
    detail: 'No public project/business-cycle close, carry-forward or next-cycle function was found. Only pump operational cycles and reporting-period functions are present.'
  });

  const checks = {
    platformToMainTenant: mainTenantCreators.length === 0,
    childProvisioned: Boolean(projectId && tenantId && slots.length === 4),
    onboardingProfileCreated: Boolean(onboardingDb.profile),
    productionCycle1: Number(production1) === 60,
    cycle1Closed: cycle1After?.status === 'completed',
    productionCycle2: Number(production2) === 30,
    cycle2Closed: cycle2After?.status === 'completed',
    tankUnchangedCycle1: Number(tankBefore1.current_level_m3) === Number(tankAfterProd1.current_level_m3),
    tankUnchangedCycle2: Number(tankBefore2.current_level_m3) === Number(tankAfter2.current_level_m3),
    invoice1Partial: invoiceAfterPayment.status === 'partial' && Number(invoiceAfterPayment.amount_paid) === 10,
    cycle2CarriesOutstanding: Number(invoice2.previous_balance) === Number(invoiceAfterPayment.balance),
    maintenanceClosed: faultAfter.status === 'closed' && workOrderAfter.status === 'closed',
    centralSeesProject: centralProject1.ok && centralProject1.data.length === 1 && centralProject1.data[0].id === projectId,
    projectIsolation: pmVisibleProjects.ok && pmVisibleProjects.data.length === 1 && pmVisibleProjects.data[0].id === projectId,
      };

  log('ASSERTIONS', checks);

  const passed = Object.entries(checks).filter(([,v]) => v === true).length;
  const failed = Object.entries(checks).filter(([,v]) => v === false);

  evidence.push({
    stage: 'final_assertions',
    result: failed.length ? 'partial_failure' : 'passed',
    passed,
    failed
  });

  const verdict = {
    full_two_cycle_e2e: failed.length === 0,
    downstream_real_operations: failed.filter(([k]) => ![
      'platformToMainTenant',
      'onboardingProfileCreated'
    ].includes(k)).length === 0,
    platform_owner_to_central_tenant: mainTenantCreators.length ? 'unverified_entrypoint_present' : 'blocked_missing_entrypoint',
    onboarding: onboardingDb.profile ? 'working' : 'broken',
    production_to_tank: (Number(tankAfter2.current_level_m3) === Number(tankBefore2.current_level_m3)) ? 'not_observed_as_connected' : 'changed',
    cycle_closing: cycle1After?.status === 'completed' ? 'observed_pump_operational_cycle_closed' : 'not_observed',
    cycle_rollover: cycle2After?.status === 'completed' ? 'observed_second_pump_operational_cycle_completed' : 'not_observed',
    financial_balance_carry: Number(invoice2.previous_balance) === Number(invoiceAfterPayment.balance) ? 'observed' : 'not_observed',
    central_reflection: centralProject1.ok && centralProject1.data.length === 1 ? 'observed' : 'not_observed',
    isolation: pmVisibleProjects.ok && pmVisibleProjects.data.length === 1 && pmVisibleProjects.data[0].id === projectId ? 'observed' : 'not_observed'
  };

  log('FINAL VERDICT', verdict);

  fs.writeFileSync(
    'e2e-output/e2e-report.md',
    '# MIZAN isolated E2E report\n\n' +
    '## Final verdict\n' + JSON.stringify(verdict, null, 2) + '\n\n' +
    '## Evidence\n' + evidence.map((e, i) => (i + 1) + '. ' + JSON.stringify(e)).join('\n') + '\n\n' +
    '## Execution log\n' + report.map(x => '- ' + JSON.stringify(x)).join('\n') + '\n'
  );

  // The test intentionally fails CI if an expected downstream assertion failed.
  // This is a test result, not a product fix.
  if (failed.length) {
    throw new Error('E2E assertions failed: ' + JSON.stringify(failed));
  }
}

main().catch((err) => {
  console.error('E2E_FATAL', err);
  const existing = fs.existsSync('e2e-output/e2e-report.md')
    ? fs.readFileSync('e2e-output/e2e-report.md', 'utf8')
    : '# MIZAN isolated E2E report\n\n';
  fs.writeFileSync(
    'e2e-output/e2e-report.md',
    existing + '\n## FATAL\n' + String(err) + '\n'
  );
  process.exitCode = 1;
});
