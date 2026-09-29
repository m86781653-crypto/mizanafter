create or replace function public.mizan_report_fault(
  p_project_id uuid, p_fault_type text, p_severity text default 'medium',
  p_description text default null, p_asset_id uuid default null, p_well_id uuid default null, p_pump_id uuid default null
) returns public.faults language plpgsql security definer set search_path=''
as $$
declare v_fault public.faults;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_project_id is null or nullif(trim(coalesce(p_fault_type,'')),'') is null then raise exception 'FAULT_TYPE_REQUIRED'; end if;
  if p_severity not in ('low','medium','high','critical') then raise exception 'INVALID_SEVERITY'; end if;
  if not private.mizan_can_write_project(p_project_id,'faults','insert') then raise exception 'FAULT_CREATE_FORBIDDEN'; end if;
  insert into public.faults(project_id,fault_type,severity,status,description,reported_by,reporter_type,asset_id,well_id,pump_id)
  values(p_project_id,trim(p_fault_type),p_severity,'reported',nullif(trim(p_description),''),(select full_name from public.profiles where id=auth.uid()),'staff',p_asset_id,p_well_id,p_pump_id)
  returning * into v_fault;
  return v_fault;
end; $$;

create or replace function public.mizan_update_fault_status(
  p_fault_id uuid, p_status text, p_resolution_notes text default null
) returns public.faults language plpgsql security definer set search_path=''
as $$
declare v_fault public.faults; v_old text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_fault from public.faults where id=p_fault_id for update;
  if v_fault.id is null then raise exception 'FAULT_NOT_FOUND'; end if;
  if not private.mizan_can_write_project(v_fault.project_id,'faults','update') then raise exception 'FAULT_UPDATE_FORBIDDEN'; end if;
  v_old:=v_fault.status;
  if p_status not in ('reported','verified','in_progress','resolved','closed') then raise exception 'INVALID_FAULT_STATUS'; end if;
  if p_status='closed' and v_old <> 'resolved' then raise exception 'FAULT_MUST_BE_RESOLVED_BEFORE_CLOSURE'; end if;
  update public.faults set status=p_status,
    verified_at=case when p_status='verified' and verified_at is null then now() else verified_at end,
    resolved_at=case when p_status='resolved' and resolved_at is null then now() when p_status in ('reported','verified','in_progress') then null else resolved_at end,
    resolution_notes=case when p_resolution_notes is not null then nullif(trim(p_resolution_notes),'') else resolution_notes end
  where id=p_fault_id returning * into v_fault;
  return v_fault;
end; $$;

create or replace function public.mizan_create_work_order(
  p_project_id uuid, p_description text, p_type text default 'corrective', p_priority text default 'medium',
  p_assigned_to text default null, p_scheduled_date date default null, p_fault_id uuid default null,
  p_asset_id uuid default null, p_well_id uuid default null, p_pump_id uuid default null
) returns public.maintenance_work_orders language plpgsql security definer set search_path=''
as $$
declare v_wo public.maintenance_work_orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_description,'')),'') is null then raise exception 'WORK_ORDER_DESCRIPTION_REQUIRED'; end if;
  if p_type not in ('corrective','preventive','inspection','emergency') then raise exception 'INVALID_WORK_ORDER_TYPE'; end if;
  if p_priority not in ('low','medium','high','urgent') then raise exception 'INVALID_WORK_ORDER_PRIORITY'; end if;
  if not private.mizan_can_write_project(p_project_id,'maintenance_work_orders','insert') then raise exception 'WORK_ORDER_CREATE_FORBIDDEN'; end if;
  if p_fault_id is not null and not exists(select 1 from public.faults where id=p_fault_id and project_id=p_project_id) then raise exception 'FAULT_PROJECT_MISMATCH'; end if;
  insert into public.maintenance_work_orders(project_id,fault_id,asset_id,well_id,pump_id,type,priority,status,description,assigned_to,scheduled_date)
  values(p_project_id,p_fault_id,p_asset_id,p_well_id,p_pump_id,p_type,p_priority,'open',trim(p_description),nullif(trim(p_assigned_to),''),p_scheduled_date)
  returning * into v_wo;
  return v_wo;
end; $$;

create or replace function public.mizan_update_work_order_status(
  p_work_order_id uuid, p_status text, p_notes text default null
) returns public.maintenance_work_orders language plpgsql security definer set search_path=''
as $$
declare v_wo public.maintenance_work_orders; v_old text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_wo from public.maintenance_work_orders where id=p_work_order_id for update;
  if v_wo.id is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if not private.mizan_can_write_project(v_wo.project_id,'maintenance_work_orders','update') then raise exception 'WORK_ORDER_UPDATE_FORBIDDEN'; end if;
  v_old:=v_wo.status;
  if p_status not in ('open','in_progress','completed','cancelled','review_required') then raise exception 'INVALID_WORK_ORDER_STATUS'; end if;
  if v_old='completed' and p_status <> 'completed' then raise exception 'COMPLETED_WORK_ORDER_IMMUTABLE'; end if;
  update public.maintenance_work_orders set status=p_status,
    completed_date=case when p_status='completed' then coalesce(completed_date,now()) when p_status <> 'completed' then null else completed_date end,
    notes=case when p_notes is not null then nullif(trim(p_notes),'') else notes end
  where id=p_work_order_id returning * into v_wo;
  return v_wo;
end; $$;

create or replace function public.mizan_update_service_interruption_status(
  p_interruption_id uuid, p_status text, p_resolution_notes text default null
) returns public.service_interruptions language plpgsql security definer set search_path=''
as $$
declare v_row public.service_interruptions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.service_interruptions where id=p_interruption_id for update;
  if v_row.id is null then raise exception 'INTERRUPTION_NOT_FOUND'; end if;
  if not private.mizan_can_write_project(v_row.project_id,'service_interruptions','update') then raise exception 'INTERRUPTION_UPDATE_FORBIDDEN'; end if;
  if p_status not in ('open','investigating','mitigating','restored','closed') then raise exception 'INVALID_INTERRUPTION_STATUS'; end if;
  if p_status='closed' and v_row.status <> 'restored' then raise exception 'INTERRUPTION_MUST_BE_RESTORED_BEFORE_CLOSURE'; end if;
  update public.service_interruptions set status=p_status,
    restored_at=case when p_status='restored' then coalesce(restored_at,now()) else restored_at end,
    closed_at=case when p_status='closed' then coalesce(closed_at,now()) else closed_at end,
    resolution_notes=case when p_resolution_notes is not null then nullif(trim(p_resolution_notes),'') else resolution_notes end
  where id=p_interruption_id returning * into v_row;
  return v_row;
end; $$;

revoke insert,update,delete on public.faults from authenticated;
revoke insert,update,delete on public.maintenance_work_orders from authenticated;
revoke insert,update on public.service_interruptions from authenticated;

grant execute on function public.mizan_report_fault(uuid,text,text,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.mizan_update_fault_status(uuid,text,text) to authenticated;
grant execute on function public.mizan_create_work_order(uuid,text,text,text,text,date,uuid,uuid,uuid,uuid) to authenticated;
grant execute on function public.mizan_update_work_order_status(uuid,text,text) to authenticated;
grant execute on function public.mizan_update_service_interruption_status(uuid,text,text) to authenticated;