-- Authorization permission catalog must exist before the private security kernel.
create table if not exists public.mizan_role_permissions (
  role_code text not null,
  permission_code text not null,
  primary key (role_code, permission_code)
);
alter table public.mizan_role_permissions enable row level security;
revoke all on public.mizan_role_permissions from anon, authenticated;

insert into public.mizan_role_permissions(role_code,permission_code) values
('platform_admin','audit.read'),('platform_admin','audit.write_system'),('platform_admin','billing.manage'),('platform_admin','collection.record'),('platform_admin','customer.manage'),('platform_admin','data.exception'),('platform_admin','maintenance.execute'),('platform_admin','maintenance.manage'),('platform_admin','meter.capture'),('platform_admin','meter.exception'),('platform_admin','project.manage'),('platform_admin','project.read'),
('tenant_manager','audit.read'),('tenant_manager','audit.write_system'),('tenant_manager','billing.manage'),('tenant_manager','collection.record'),('tenant_manager','customer.manage'),('tenant_manager','data.exception'),('tenant_manager','maintenance.execute'),('tenant_manager','maintenance.manage'),('tenant_manager','meter.capture'),('tenant_manager','meter.exception'),('tenant_manager','project.manage'),('tenant_manager','project.read'),
('operations_officer','billing.manage'),('operations_officer','customer.manage'),('operations_officer','maintenance.execute'),('operations_officer','maintenance.manage'),('operations_officer','meter.capture'),('operations_officer','meter.exception'),('operations_officer','project.manage'),('operations_officer','project.read'),
('meter_reader','meter.capture'),('meter_reader','project.read'),
('collection_officer','collection.record'),('collection_officer','project.read'),
('maintenance_officer','maintenance.manage'),('maintenance_officer','project.read'),
('technician','maintenance.execute'),('technician','project.read'),
('data_exception_officer','data.exception'),('data_exception_officer','meter.exception'),('data_exception_officer','project.read'),
('viewer','project.read'),('read_only','project.read'),
('project_manager','audit.read'),('project_manager','audit.write_system'),('project_manager','billing.manage'),('project_manager','collection.record'),('project_manager','customer.manage'),('project_manager','data.exception'),('project_manager','maintenance.execute'),('project_manager','maintenance.manage'),('project_manager','meter.capture'),('project_manager','meter.exception'),('project_manager','project.manage'),('project_manager','project.read'),
('collector','collection.record'),('collector','project.read'),
('maintenance_tech','maintenance.execute'),('maintenance_tech','project.read'),
('super_admin','audit.read'),('super_admin','audit.write_system'),('super_admin','billing.manage'),('super_admin','collection.record'),('super_admin','customer.manage'),('super_admin','data.exception'),('super_admin','maintenance.execute'),('super_admin','maintenance.manage'),('super_admin','meter.capture'),('super_admin','meter.exception'),('super_admin','project.manage'),('super_admin','project.read')
on conflict do nothing;
