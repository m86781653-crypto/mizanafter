-- Unified operational data-entry and maintenance workflow.
-- All numbering is database-owned; client input is limited to real-world facts.

create or replace function public.mizan_register_subscriber(
  p_project_id uuid,p_name_ar text,p_phone text default null,p_address text default null,
  p_customer_type text default 'residential',p_status text default 'active',
  p_connection_date date default null,p_household_members integer default 1,
  p_notes text default null,p_meter_serial_number text default null,
  p_meter_type text default 'mechanical',p_meter_size_mm integer default null,
  p_meter_status text default 'active',p_meter_installation_date date default null
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_customer public.customers; v_meter public.meters;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_name_ar,'')),'') is null then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  if p_household_members is null or p_household_members < 1 then raise exception 'INVALID_HOUSEHOLD_MEMBERS'; end if;
  if not private.mizan_can_write_project(p_project_id,'customers','insert') then raise exception 'CUSTOMER_WRITE_FORBIDDEN'; end if;
  if p_meter_serial_number is not null and not private.mizan_can_write_project(p_project_id,'meters','insert') then raise exception 'METER_WRITE_FORBIDDEN'; end if;
  insert into public.customers(project_id,name_ar,phone,address,customer_type,status,connection_date,household_members,notes)
  values(p_project_id,trim(p_name_ar),nullif(trim(p_phone),''),nullif(trim(p_address),''),
    coalesce(nullif(trim(p_customer_type),''),'residential'),coalesce(nullif(trim(p_status),''),'active'),
    p_connection_date,p_household_members,nullif(trim(p_notes),''))
  returning * into v_customer;
  if p_meter_serial_number is not null then
    insert into public.meters(project_id,customer_id,serial_number,meter_type,size_mm,status,installation_date)
    values(p_project_id,v_customer.id,nullif(trim(p_meter_serial_number),''),
      coalesce(nullif(trim(p_meter_type),''),'mechanical'),p_meter_size_mm,
      coalesce(nullif(trim(p_meter_status),''),'active'),p_meter_installation_date)
    returning * into v_meter;
  end if;
  return jsonb_build_object('customer',to_jsonb(v_customer),'meter',case when v_meter.id is null then null else to_jsonb(v_meter) end);
end; $$;
revoke all on function public.mizan_register_subscriber(uuid,text,text,text,text,text,date,integer,text,text,text,integer,text,date) from public,anon,authenticated;
grant execute on function public.mizan_register_subscriber(uuid,text,text,text,text,text,date,integer,text,text,text,integer,text,date) to authenticated;

create or replace function public.mizan_assign_work_order(p_work_order_id uuid,p_assigned_to text,p_scheduled_date date default null)
returns public.maintenance_work_orders language plpgsql security definer set search_path=''
as $$
declare v_wo public.maintenance_work_orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_assigned_to,'')),'') is null then raise exception 'ASSIGNEE_NAME_REQUIRED'; end if;
  select * into v_wo from public.maintenance_work_orders where id=p_work_order_id for update;
  if v_wo.id is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if not private.mizan_can_write_project(v_wo.project_id,'maintenance_work_orders','update') then raise exception 'WORK_ORDER_UPDATE_FORBIDDEN'; end if;
  update public.maintenance_work_orders
  set assigned_to=trim(p_assigned_to),scheduled_date=coalesce(p_scheduled_date,scheduled_date),
      status=case when status='open' then 'in_progress' else status end
  where id=p_work_order_id returning * into v_wo;
  perform private.mizan_write_audit(v_wo.project_id,'WORK_ORDER_ASSIGNED','maintenance_work_order',v_wo.id,null,
    jsonb_build_object('work_order_number',v_wo.work_order_number,'assigned_to',v_wo.assigned_to,'scheduled_date',v_wo.scheduled_date),null,'success');
  return v_wo;
end; $$;
revoke all on function public.mizan_assign_work_order(uuid,text,date) from public,anon,authenticated;
grant execute on function public.mizan_assign_work_order(uuid,text,date) to authenticated;

create or replace function public.mizan_fault_to_work_order()
returns trigger language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
  if tg_op='INSERT' and new.status not in ('resolved','closed') then
    insert into public.maintenance_work_orders(project_id,fault_id,asset_id,well_id,pump_id,type,priority,status,description,assigned_to,scheduled_date,notes)
    values(new.project_id,new.id,new.asset_id,new.well_id,new.pump_id,'corrective',
      case when new.severity='critical' then 'urgent' when new.severity='high' then 'high' when new.severity='low' then 'low' else 'medium' end,
      'open',coalesce('معالجة العطل '||new.fault_number||': '||new.description,'معالجة عطل مسجل'),null,null,
      'تم إنشاء أمر الصيانة تلقائياً من بلاغ العطل. يحدد مدير المشروع اسم المنفذ لاحقاً.');
  end if;
  return new;
end; $$;
drop trigger if exists mizan_fault_create_work_order on public.faults;
create trigger mizan_fault_create_work_order after insert on public.faults for each row execute function public.mizan_fault_to_work_order();
revoke all on function public.mizan_fault_to_work_order() from public,anon,authenticated;
grant execute on function public.mizan_fault_to_work_order() to service_role;