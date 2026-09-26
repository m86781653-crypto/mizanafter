-- Correct operational-number trigger dispatch: PostgreSQL trigger records cannot be
-- referenced through fields that belong to other tables. Use one typed trigger
-- function per table so every INSERT path is safe and deterministic.

drop trigger if exists mizan_assign_well_number on public.wells;
drop trigger if exists mizan_assign_pump_number on public.pumps;
drop trigger if exists mizan_assign_tank_number on public.tanks;
drop trigger if exists mizan_assign_asset_number on public.assets;
drop trigger if exists mizan_assign_customer_number on public.customers;
drop trigger if exists mizan_assign_meter_number on public.meters;
drop trigger if exists mizan_assign_fault_number on public.faults;
drop trigger if exists mizan_assign_work_order_number on public.maintenance_work_orders;
drop trigger if exists mizan_assign_field_task_number on public.field_tasks;
drop trigger if exists mizan_assign_invoice_number on public.invoices;

create or replace function public.mizan_assign_well_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.code),'') is null then new.code:=public.mizan_next_project_code(new.project_id,'well','WELL-'); end if; return new; end $$;
create or replace function public.mizan_assign_pump_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.code),'') is null then new.code:=public.mizan_next_project_code(new.project_id,'pump','PUMP-'); end if; return new; end $$;
create or replace function public.mizan_assign_tank_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.code),'') is null then new.code:=public.mizan_next_project_code(new.project_id,'tank','TANK-'); end if; return new; end $$;
create or replace function public.mizan_assign_asset_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.asset_code),'') is null then new.asset_code:=public.mizan_next_project_code(new.project_id,'asset','AST-'); end if; return new; end $$;
create or replace function public.mizan_assign_customer_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.customer_number),'') is null then new.customer_number:=public.mizan_next_project_code(new.project_id,'customer','CUS-'); end if; return new; end $$;
create or replace function public.mizan_assign_meter_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.meter_number),'') is null then new.meter_number:=public.mizan_next_project_code(new.project_id,'meter','MTR-'); end if; return new; end $$;
create or replace function public.mizan_assign_fault_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.fault_number),'') is null then new.fault_number:=public.mizan_next_project_code(new.project_id,'fault','FLT-'); end if; return new; end $$;
create or replace function public.mizan_assign_work_order_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.work_order_number),'') is null then new.work_order_number:=public.mizan_next_project_code(new.project_id,'work_order','WO-'); end if; return new; end $$;
create or replace function public.mizan_assign_field_task_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.task_number),'') is null then new.task_number:=public.mizan_next_project_code(new.project_id,'field_task','TASK-'); end if; return new; end $$;
create or replace function public.mizan_assign_invoice_number() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if nullif(trim(new.invoice_number),'') is null then new.invoice_number:=public.mizan_next_project_code(new.project_id,'invoice','INV-'); end if; return new; end $$;

revoke all on function public.mizan_assign_well_number() from public,anon,authenticated;
revoke all on function public.mizan_assign_pump_number() from public,anon,authenticated;
revoke all on function public.mizan_assign_tank_number() from public,anon,authenticated;
revoke all on function public.mizan_assign_asset_number() from public,anon,authenticated;
revoke all on function public.mizan_assign_customer_number() from public,anon,authenticated;
revoke all on function public.mizan_assign_meter_number() from public,anon,authenticated;
revoke all on function public.mizan_assign_fault_number() from public,anon,authenticated;
revoke all on function public.mizan_assign_work_order_number() from public,anon,authenticated;
revoke all on function public.mizan_assign_field_task_number() from public,anon,authenticated;
revoke all on function public.mizan_assign_invoice_number() from public,anon,authenticated;
grant execute on function public.mizan_assign_well_number() to service_role;
grant execute on function public.mizan_assign_pump_number() to service_role;
grant execute on function public.mizan_assign_tank_number() to service_role;
grant execute on function public.mizan_assign_asset_number() to service_role;
grant execute on function public.mizan_assign_customer_number() to service_role;
grant execute on function public.mizan_assign_meter_number() to service_role;
grant execute on function public.mizan_assign_fault_number() to service_role;
grant execute on function public.mizan_assign_work_order_number() to service_role;
grant execute on function public.mizan_assign_field_task_number() to service_role;
grant execute on function public.mizan_assign_invoice_number() to service_role;

create trigger mizan_assign_well_number before insert on public.wells for each row execute function public.mizan_assign_well_number();
create trigger mizan_assign_pump_number before insert on public.pumps for each row execute function public.mizan_assign_pump_number();
create trigger mizan_assign_tank_number before insert on public.tanks for each row execute function public.mizan_assign_tank_number();
create trigger mizan_assign_asset_number before insert on public.assets for each row execute function public.mizan_assign_asset_number();
create trigger mizan_assign_customer_number before insert on public.customers for each row execute function public.mizan_assign_customer_number();
create trigger mizan_assign_meter_number before insert on public.meters for each row execute function public.mizan_assign_meter_number();
create trigger mizan_assign_fault_number before insert on public.faults for each row execute function public.mizan_assign_fault_number();
create trigger mizan_assign_work_order_number before insert on public.maintenance_work_orders for each row execute function public.mizan_assign_work_order_number();
create trigger mizan_assign_field_task_number before insert on public.field_tasks for each row execute function public.mizan_assign_field_task_number();
create trigger mizan_assign_invoice_number before insert on public.invoices for each row execute function public.mizan_assign_invoice_number();
