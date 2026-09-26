-- Root hardening: maintenance work-order writes are server-authoritative.
create or replace function public.mizan_create_work_order(
  p_project_id uuid,
  p_description text,
  p_type text default 'corrective',
  p_priority text default 'medium',
  p_assigned_to text default null,
  p_scheduled_date date default null,
  p_fault_id uuid default null,
  p_asset_id uuid default null,
  p_well_id uuid default null,
  p_pump_id uuid default null
)
returns public.maintenance_work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wo public.maintenance_work_orders;
  v_number text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_description,'')), '') is null then raise exception 'WORK_ORDER_DESCRIPTION_REQUIRED'; end if;
  if p_type not in ('corrective','preventive','emergency') then raise exception 'INVALID_WORK_ORDER_TYPE'; end if;
  if p_priority not in ('low','medium','high','urgent') then raise exception 'INVALID_WORK_ORDER_PRIORITY'; end if;
  if not private.mizan_can_write_project(p_project_id,'maintenance_work_orders','insert') then
    raise exception 'WORK_ORDER_WRITE_FORBIDDEN';
  end if;
  if p_fault_id is not null and not exists (select 1 from public.faults f where f.id=p_fault_id and f.project_id=p_project_id) then raise exception 'FAULT_NOT_FOUND'; end if;
  if p_asset_id is not null and not exists (select 1 from public.assets a where a.id=p_asset_id and a.project_id=p_project_id) then raise exception 'ASSET_NOT_FOUND'; end if;
  if p_well_id is not null and not exists (select 1 from public.wells w where w.id=p_well_id and w.project_id=p_project_id) then raise exception 'WELL_NOT_FOUND'; end if;
  if p_pump_id is not null and not exists (select 1 from public.pumps p where p.id=p_pump_id and p.project_id=p_project_id) then raise exception 'PUMP_NOT_FOUND'; end if;

  v_number := public.mizan_next_project_code(p_project_id,'WO','WO-');
  insert into public.maintenance_work_orders(
    project_id,work_order_number,type,priority,status,description,assigned_to,
    scheduled_date,fault_id,asset_id,well_id,pump_id
  ) values (
    p_project_id,v_number,p_type,p_priority,'open',trim(p_description),nullif(trim(p_assigned_to),''),
    p_scheduled_date,p_fault_id,p_asset_id,p_well_id,p_pump_id
  ) returning * into v_wo;

  perform private.mizan_write_audit(
    p_project_id,'WORK_ORDER_CREATED','maintenance_work_order',v_wo.id,null,
    jsonb_build_object('work_order_number',v_wo.work_order_number,'fault_id',p_fault_id,
      'assigned_to',v_wo.assigned_to,'priority',v_wo.priority),null,'success'
  );
  return v_wo;
end;
$$;

create or replace function public.mizan_update_work_order_status(p_work_order_id uuid,p_status text)
returns public.maintenance_work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare v_wo public.maintenance_work_orders; v_project_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_status not in ('open','in_progress','completed','cancelled') then raise exception 'INVALID_WORK_ORDER_STATUS'; end if;
  select project_id into v_project_id from public.maintenance_work_orders where id=p_work_order_id for update;
  if v_project_id is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if not private.mizan_can_write_project(v_project_id,'maintenance_work_orders','update') then raise exception 'WORK_ORDER_UPDATE_FORBIDDEN'; end if;
  update public.maintenance_work_orders
     set status=p_status, completed_date=case when p_status='completed' then coalesce(completed_date,now()) else completed_date end
   where id=p_work_order_id returning * into v_wo;
  perform private.mizan_write_audit(v_project_id,'WORK_ORDER_STATUS_CHANGED','maintenance_work_order',v_wo.id,null,
    jsonb_build_object('status',p_status),null,'success');
  return v_wo;
end;
$$;

revoke all on function public.mizan_create_work_order(uuid,text,text,text,text,date,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.mizan_create_work_order(uuid,text,text,text,text,date,uuid,uuid,uuid,uuid) to authenticated;
revoke all on function public.mizan_update_work_order_status(uuid,text) from public,anon,authenticated;
grant execute on function public.mizan_update_work_order_status(uuid,text) to authenticated;
revoke insert,update,delete on public.maintenance_work_orders from anon,authenticated;
