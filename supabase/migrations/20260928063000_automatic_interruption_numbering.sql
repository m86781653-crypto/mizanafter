-- Operational numbering for service interruptions.
create or replace function public.mizan_assign_operational_number()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
  if tg_table_name='service_interruptions' and nullif(trim(new.interruption_number),'') is null then
    new.interruption_number:=public.mizan_next_project_code(new.project_id,'interruption','INT-');
  elsif tg_table_name='wells' and nullif(trim(new.code),'') is null then new.code:=public.mizan_next_project_code(new.project_id,'well','WELL-');
  elsif tg_table_name='pumps' and nullif(trim(new.code),'') is null then new.code:=public.mizan_next_project_code(new.project_id,'pump','PUMP-');
  elsif tg_table_name='tanks' and nullif(trim(new.code),'') is null then new.code:=public.mizan_next_project_code(new.project_id,'tank','TANK-');
  elsif tg_table_name='assets' and nullif(trim(new.asset_code),'') is null then new.asset_code:=public.mizan_next_project_code(new.project_id,'asset','AST-');
  elsif tg_table_name='customers' and nullif(trim(new.customer_number),'') is null then new.customer_number:=public.mizan_next_project_code(new.project_id,'customer','CUS-');
  elsif tg_table_name='meters' and nullif(trim(new.meter_number),'') is null then new.meter_number:=public.mizan_next_project_code(new.project_id,'meter','MTR-');
  elsif tg_table_name='faults' and nullif(trim(new.fault_number),'') is null then new.fault_number:=public.mizan_next_project_code(new.project_id,'fault','FLT-');
  elsif tg_table_name='maintenance_work_orders' and nullif(trim(new.work_order_number),'') is null then new.work_order_number:=public.mizan_next_project_code(new.project_id,'work_order','WO-');
  elsif tg_table_name='field_tasks' and nullif(trim(new.task_number),'') is null then new.task_number:=public.mizan_next_project_code(new.project_id,'field_task','TASK-');
  elsif tg_table_name='invoices' and nullif(trim(new.invoice_number),'') is null then new.invoice_number:=public.mizan_next_project_code(new.project_id,'invoice','INV-');
  end if; return new;
end; $$;
drop trigger if exists mizan_assign_interruption_number on public.service_interruptions;
create trigger mizan_assign_interruption_number before insert on public.service_interruptions for each row execute function public.mizan_assign_operational_number();
create unique index if not exists service_interruptions_project_number_uidx on public.service_interruptions(project_id,interruption_number);