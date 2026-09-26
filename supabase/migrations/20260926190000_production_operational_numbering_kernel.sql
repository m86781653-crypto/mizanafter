-- MIZAN production operational numbering kernel.

create or replace function public.mizan_next_project_code(
  p_project_id uuid,
  p_sequence_name text,
  p_prefix text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_counter bigint;
begin
  if p_project_id is null then raise exception 'project_id is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text || ':' || p_sequence_name, 0));
  insert into public.project_seq_counters (id, project_id, seq_name, counter)
  values (p_project_id::text || ':' || p_sequence_name, p_project_id, p_sequence_name, 0)
  on conflict (id) do nothing;
  update public.project_seq_counters
     set counter = counter + 1
   where id = p_project_id::text || ':' || p_sequence_name
   returning counter into v_counter;
  return p_prefix || lpad(v_counter::text, 6, '0');
end;
$$;

revoke all on function public.mizan_next_project_code(uuid,text,text) from public, anon, authenticated;
grant execute on function public.mizan_next_project_code(uuid,text,text) to service_role;

create or replace function public.mizan_assign_operational_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'wells' and nullif(trim(new.code), '') is null then
    new.code := public.mizan_next_project_code(new.project_id, 'well', 'WELL-');
  elsif tg_table_name = 'pumps' and nullif(trim(new.code), '') is null then
    new.code := public.mizan_next_project_code(new.project_id, 'pump', 'PUMP-');
  elsif tg_table_name = 'tanks' and nullif(trim(new.code), '') is null then
    new.code := public.mizan_next_project_code(new.project_id, 'tank', 'TANK-');
  elsif tg_table_name = 'assets' and nullif(trim(new.asset_code), '') is null then
    new.asset_code := public.mizan_next_project_code(new.project_id, 'asset', 'AST-');
  elsif tg_table_name = 'customers' and nullif(trim(new.customer_number), '') is null then
    new.customer_number := public.mizan_next_project_code(new.project_id, 'customer', 'CUS-');
  elsif tg_table_name = 'meters' and nullif(trim(new.meter_number), '') is null then
    new.meter_number := public.mizan_next_project_code(new.project_id, 'meter', 'MTR-');
  elsif tg_table_name = 'faults' and nullif(trim(new.fault_number), '') is null then
    new.fault_number := public.mizan_next_project_code(new.project_id, 'fault', 'FLT-');
  elsif tg_table_name = 'maintenance_work_orders' and nullif(trim(new.work_order_number), '') is null then
    new.work_order_number := public.mizan_next_project_code(new.project_id, 'work_order', 'WO-');
  elsif tg_table_name = 'field_tasks' and nullif(trim(new.task_number), '') is null then
    new.task_number := public.mizan_next_project_code(new.project_id, 'field_task', 'TASK-');
  elsif tg_table_name = 'invoices' and nullif(trim(new.invoice_number), '') is null then
    new.invoice_number := public.mizan_next_project_code(new.project_id, 'invoice', 'INV-');
  end if;
  return new;
end;
$$;

revoke all on function public.mizan_assign_operational_number() from public, anon, authenticated;
grant execute on function public.mizan_assign_operational_number() to service_role;

drop trigger if exists mizan_assign_well_number on public.wells;
create trigger mizan_assign_well_number before insert on public.wells for each row execute function public.mizan_assign_operational_number();
drop trigger if exists mizan_assign_pump_number on public.pumps;
create trigger mizan_assign_pump_number before insert on public.pumps for each row execute function public.mizan_assign_operational_number();
drop trigger if exists mizan_assign_tank_number on public.tanks;
create trigger mizan_assign_tank_number before insert on public.tanks for each row execute function public.mizan_assign_operational_number();
drop trigger if exists mizan_assign_asset_number on public.assets;
create trigger mizan_assign_asset_number before insert on public.assets for each row execute function public.mizan_assign_operational_number();
drop trigger if exists mizan_assign_customer_number on public.customers;
create trigger mizan_assign_customer_number before insert on public.customers for each row execute function public.mizan_assign_operational_number();
drop trigger if exists mizan_assign_meter_number on public.meters;
create trigger mizan_assign_meter_number before insert on public.meters for each row execute function public.mizan_assign_operational_number();
drop trigger if exists mizan_assign_fault_number on public.faults;
create trigger mizan_assign_fault_number before insert on public.faults for each row execute function public.mizan_assign_operational_number();
drop trigger if exists mizan_assign_work_order_number on public.maintenance_work_orders;
create trigger mizan_assign_work_order_number before insert on public.maintenance_work_orders for each row execute function public.mizan_assign_operational_number();
drop trigger if exists mizan_assign_field_task_number on public.field_tasks;
create trigger mizan_assign_field_task_number before insert on public.field_tasks for each row execute function public.mizan_assign_operational_number();
drop trigger if exists mizan_assign_invoice_number on public.invoices;
create trigger mizan_assign_invoice_number before insert on public.invoices for each row execute function public.mizan_assign_operational_number();

create unique index if not exists wells_project_code_uidx on public.wells(project_id, code);
create unique index if not exists pumps_project_code_uidx on public.pumps(project_id, code);
create unique index if not exists tanks_project_code_uidx on public.tanks(project_id, code);
create unique index if not exists assets_project_code_uidx on public.assets(project_id, asset_code);
create unique index if not exists customers_project_number_uidx on public.customers(project_id, customer_number);
create unique index if not exists meters_project_number_uidx on public.meters(project_id, meter_number);
create unique index if not exists faults_project_number_uidx on public.faults(project_id, fault_number);
create unique index if not exists work_orders_project_number_uidx on public.maintenance_work_orders(project_id, work_order_number);
create unique index if not exists field_tasks_project_number_uidx on public.field_tasks(project_id, task_number);
create unique index if not exists invoices_project_number_uidx on public.invoices(project_id, invoice_number);
