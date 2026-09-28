create unique index if not exists ux_meters_project_serial_number on public.meters(project_id, serial_number) where serial_number is not null;
alter table public.meters drop constraint if exists meters_active_serial_required;
alter table public.meters add constraint meters_active_serial_required check (status <> 'active' or nullif(trim(serial_number),'') is not null);
alter table public.customers drop constraint if exists customers_household_members_nonnegative;
alter table public.customers add constraint customers_household_members_nonnegative check (household_members is null or household_members >= 0);