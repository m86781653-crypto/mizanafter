insert into public.mizan_role_catalog(role_code,name_ar,description_ar,is_legacy) values ('operations_maintenance','مسؤول التشغيل والصيانة','تشغيل ومراقبة الآبار والمضخات وتوثيق إنتاج المياه وإدارة الأعطال والصيانة وأوامر العمل ضمن المشروع.',false) on conflict(role_code) do update set name_ar=excluded.name_ar,description_ar=excluded.description_ar,is_legacy=false;
insert into public.mizan_permissions(permission_code,name_ar,description_ar) values
('water.production.capture','تسجيل إنتاج المياه','التقاط وتسجيل قراءات عداد إنتاج المضخة ودورات التشغيل والإيقاف مع الأدلة الميدانية.'),
('water.production.read','قراءة إنتاج المياه','عرض قراءات إنتاج المياه ودورات تشغيل المضخات ضمن النطاق المسموح.'),
('water.production.review','مراجعة إنتاج المياه','مراجعة واعتماد أو رفض قراءات ودورات إنتاج المياه وفق سير العمل.')
on conflict(permission_code) do update set name_ar=excluded.name_ar,description_ar=excluded.description_ar;
insert into public.mizan_role_permissions(role_code,permission_code) values
('operations_maintenance','water.production.capture'),('operations_maintenance','water.production.read'),
('project_manager','water.production.read'),('project_manager','water.production.review'),
('central_governance','water.production.read'),('platform_admin','water.production.read'),
('operations_maintenance','project.read'),('operations_maintenance','maintenance.manage'),('operations_maintenance','maintenance.execute'),('operations_maintenance','meter.exception')
on conflict do nothing;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role=any(array['platform_admin','central_governance','project_manager','meter_reader','collection_officer','operations_maintenance','operations_officer','maintenance_officer','technician','data_exception_officer','viewer','tenant_manager','collector','maintenance_tech','read_only','super_admin']));
create table public.water_production_meters(
id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),well_id uuid not null references public.wells(id),pump_id uuid not null references public.pumps(id),
meter_number text not null,serial_number text,unit text not null default 'm3',reading_mode text not null default 'cumulative',status text not null default 'active',
initial_reading numeric not null default 0,installed_at date,location geography,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
constraint water_production_meters_unit_chk check(unit='m3'),constraint water_production_meters_reading_mode_chk check(reading_mode='cumulative'),
constraint water_production_meters_status_chk check(status in('active','inactive','retired')),constraint water_production_meters_initial_chk check(initial_reading>=0),
constraint water_production_meters_project_pump_unique unique(project_id,pump_id));
create unique index water_production_meters_project_meter_number_uq on public.water_production_meters(project_id,meter_number);
create index water_production_meters_project_idx on public.water_production_meters(project_id);
create index water_production_meters_pump_idx on public.water_production_meters(pump_id);
create table public.water_production_readings(
id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),production_meter_id uuid not null references public.water_production_meters(id),
well_id uuid not null references public.wells(id),pump_id uuid not null references public.pumps(id),reading_value numeric not null,captured_at timestamptz not null default now(),
capture_phase text not null,image_url text,gps_lat numeric,gps_lng numeric,gps_accuracy numeric,captured_by uuid not null references public.profiles(id),
status text not null default 'pending',anomaly_flag boolean not null default false,anomaly_reason text,notes text,created_at timestamptz not null default now(),
constraint water_production_readings_value_chk check(reading_value>=0),constraint water_production_readings_phase_chk check(capture_phase in('start','stop','check')),
constraint water_production_readings_status_chk check(status in('pending','accepted','rejected','superseded')),
constraint water_production_readings_gps_lat_chk check(gps_lat is null or gps_lat between -90 and 90),constraint water_production_readings_gps_lng_chk check(gps_lng is null or gps_lng between -180 and 180));
create index water_production_readings_project_time_idx on public.water_production_readings(project_id,captured_at desc);
create index water_production_readings_meter_time_idx on public.water_production_readings(production_meter_id,captured_at desc);
create index water_production_readings_pump_time_idx on public.water_production_readings(pump_id,captured_at desc);
create table public.pump_operation_cycles(
id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),well_id uuid not null references public.wells(id),pump_id uuid not null references public.pumps(id),
production_meter_id uuid not null references public.water_production_meters(id),started_at timestamptz not null,stopped_at timestamptz,start_reading_id uuid not null unique references public.water_production_readings(id),
stop_reading_id uuid unique references public.water_production_readings(id),production_m3 numeric,status text not null default 'running',started_by uuid not null references public.profiles(id),
stopped_by uuid references public.profiles(id),notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
constraint pump_operation_cycles_status_chk check(status in('running','completed','cancelled','review_required')),
constraint pump_operation_cycles_time_chk check(stopped_at is null or stopped_at>=started_at),constraint pump_operation_cycles_production_chk check(production_m3 is null or production_m3>=0));
create unique index pump_operation_cycles_one_running_pump_uq on public.pump_operation_cycles(project_id,pump_id) where status='running';
create index pump_operation_cycles_project_time_idx on public.pump_operation_cycles(project_id,started_at desc);
create index pump_operation_cycles_pump_time_idx on public.pump_operation_cycles(pump_id,started_at desc);
alter table public.water_production_meters enable row level security;alter table public.water_production_readings enable row level security;alter table public.pump_operation_cycles enable row level security;
revoke insert,update,delete on public.water_production_meters,public.water_production_readings,public.pump_operation_cycles from authenticated;
grant select on public.water_production_meters,public.water_production_readings,public.pump_operation_cycles to authenticated;
drop policy if exists water_production_meters_select on public.water_production_meters;
create policy water_production_meters_select on public.water_production_meters for select to authenticated using(private.mizan_can_access_project(project_id));
drop policy if exists water_production_readings_select on public.water_production_readings;
create policy water_production_readings_select on public.water_production_readings for select to authenticated using(private.mizan_can_access_project(project_id) and private.mizan_has_permission('water.production.read'));
drop policy if exists pump_operation_cycles_select on public.pump_operation_cycles;
create policy pump_operation_cycles_select on public.pump_operation_cycles for select to authenticated using(private.mizan_can_access_project(project_id) and private.mizan_has_permission('water.production.read'));