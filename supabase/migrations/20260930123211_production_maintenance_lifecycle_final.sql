-- Production maintenance lifecycle hardening: report -> memo -> assignment -> execution -> closure -> monthly reporting.
-- No application path uses service_role.

create or replace function public.mizan_fault_to_work_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status not in ('resolved','closed') then
    insert into public.maintenance_work_orders(
      project_id,fault_id,asset_id,well_id,pump_id,type,priority,status,
      description,assigned_to,scheduled_date,notes,memo_version,memo_issued_at,memo_issued_by
    )
    values(
      new.project_id,new.id,new.asset_id,new.well_id,new.pump_id,'corrective',
      case when new.severity='critical' then 'urgent'
           when new.severity='high' then 'high'
           else coalesce(new.severity,'medium') end,
      'open',
      coalesce('معالجة العطل ' || new.fault_number || ': ' || new.description,'معالجة عطل مسجل'),
      null,current_date,'تم إنشاء أمر العمل تلقائياً بواسطة ميزان AI من البلاغ.',1,now(),auth.uid()
    );
  end if;
  return new;
end;
$$;
revoke all on function public.mizan_fault_to_work_order() from public,anon,authenticated,service_role;

create or replace function public.mizan_assign_work_order(p_work_order_id uuid,p_assigned_to text,p_scheduled_date date default null)
returns public.maintenance_work_orders language plpgsql security definer set search_path=''
as $$
declare v_wo public.maintenance_work_orders; v_role text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=private.mizan_user_role();
  if not (v_role='project_manager' or private.mizan_is_platform_admin()) then raise exception 'WORK_ORDER_ASSIGN_FORBIDDEN'; end if;
  if nullif(trim(coalesce(p_assigned_to,'')),'') is null then raise exception 'ASSIGNEE_NAME_REQUIRED'; end if;
  select * into v_wo from public.maintenance_work_orders where id=p_work_order_id for update;
  if v_wo.id is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if not private.mizan_can_access_project(v_wo.project_id) then raise exception 'WORK_ORDER_PROJECT_FORBIDDEN'; end if;
  if v_wo.status in ('completed','closed','cancelled') then raise exception 'WORK_ORDER_ALREADY_CLOSED'; end if;
  update public.maintenance_work_orders set assigned_to=trim(p_assigned_to),scheduled_date=coalesce(p_scheduled_date,scheduled_date),status=case when status='open' then 'in_progress' else status end where id=p_work_order_id returning * into v_wo;
  perform private.mizan_write_audit(v_wo.project_id,'WORK_ORDER_ASSIGNED','maintenance_work_order',v_wo.id,null,jsonb_build_object('work_order_number',v_wo.work_order_number,'assigned_to',v_wo.assigned_to,'scheduled_date',v_wo.scheduled_date),null,'success');
  return v_wo;
end; $$;
revoke all on function public.mizan_assign_work_order(uuid,text,date) from public,anon,authenticated,service_role;
grant execute on function public.mizan_assign_work_order(uuid,text,date) to authenticated;

create or replace function public.mizan_record_work_order_execution(p_work_order_id uuid,p_downtime_hours numeric default null,p_parts_used text default null,p_cost numeric default 0,p_notes text default null)
returns public.maintenance_work_orders language plpgsql security definer set search_path=''
as $$
declare v_wo public.maintenance_work_orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.mizan_has_permission('maintenance.execute') then raise exception 'WORK_ORDER_EXECUTION_FORBIDDEN'; end if;
  if p_downtime_hours is not null and p_downtime_hours < 0 then raise exception 'INVALID_DOWNTIME_HOURS'; end if;
  if p_cost is null or p_cost < 0 then raise exception 'INVALID_MAINTENANCE_COST'; end if;
  select * into v_wo from public.maintenance_work_orders where id=p_work_order_id for update;
  if v_wo.id is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if not private.mizan_can_access_project(v_wo.project_id) then raise exception 'WORK_ORDER_PROJECT_FORBIDDEN'; end if;
  if v_wo.status <> 'in_progress' then raise exception 'WORK_ORDER_MUST_BE_IN_PROGRESS'; end if;
  if nullif(trim(coalesce(v_wo.assigned_to,'')),'') is null then raise exception 'WORK_ORDER_MUST_BE_ASSIGNED'; end if;
  update public.maintenance_work_orders set status='completed',completed_date=coalesce(completed_date,now()),downtime_hours=coalesce(p_downtime_hours,downtime_hours),parts_used=case when p_parts_used is not null then nullif(trim(p_parts_used),'') else parts_used end,cost=p_cost,notes=case when p_notes is not null then nullif(trim(p_notes),'') else notes end where id=p_work_order_id returning * into v_wo;
  perform private.mizan_write_audit(v_wo.project_id,'WORK_ORDER_EXECUTED','maintenance_work_order',v_wo.id,null,jsonb_build_object('work_order_number',v_wo.work_order_number,'downtime_hours',v_wo.downtime_hours,'cost',v_wo.cost,'parts_used',v_wo.parts_used),null,'success');
  return v_wo;
end; $$;
revoke all on function public.mizan_record_work_order_execution(uuid,numeric,text,numeric,text) from public,anon,authenticated,service_role;
grant execute on function public.mizan_record_work_order_execution(uuid,numeric,text,numeric,text) to authenticated;

create or replace function public.mizan_close_work_order(p_work_order_id uuid,p_notes text default null)
returns public.maintenance_work_orders language plpgsql security definer set search_path=''
as $$
declare v_wo public.maintenance_work_orders; v_role text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=private.mizan_user_role();
  if not (v_role='project_manager' or private.mizan_is_platform_admin()) then raise exception 'WORK_ORDER_CLOSURE_FORBIDDEN'; end if;
  select * into v_wo from public.maintenance_work_orders where id=p_work_order_id for update;
  if v_wo.id is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if not private.mizan_can_access_project(v_wo.project_id) then raise exception 'WORK_ORDER_PROJECT_FORBIDDEN'; end if;
  if v_wo.status <> 'completed' then raise exception 'WORK_ORDER_MUST_BE_COMPLETED_BEFORE_CLOSURE'; end if;
  update public.maintenance_work_orders set status='closed',notes=case when p_notes is not null then nullif(trim(p_notes),'') else notes end where id=p_work_order_id returning * into v_wo;
  if v_wo.fault_id is not null then update public.faults set status='closed',resolved_at=coalesce(resolved_at,coalesce(v_wo.completed_date,now())),resolution_notes=coalesce(nullif(trim(p_notes),''),resolution_notes) where id=v_wo.fault_id and status <> 'closed'; end if;
  perform private.mizan_write_audit(v_wo.project_id,'WORK_ORDER_CLOSED','maintenance_work_order',v_wo.id,null,jsonb_build_object('work_order_number',v_wo.work_order_number,'closed_at',now()),null,'success');
  return v_wo;
end; $$;
revoke all on function public.mizan_close_work_order(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.mizan_close_work_order(uuid,text) to authenticated;

create or replace function public.mizan_update_work_order_status(p_work_order_id uuid,p_status text,p_notes text default null)
returns public.maintenance_work_orders language plpgsql security definer set search_path=''
as $$
declare v_wo public.maintenance_work_orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_status not in ('open','in_progress','cancelled','review_required') then raise exception 'INVALID_WORK_ORDER_STATUS'; end if;
  select * into v_wo from public.maintenance_work_orders where id=p_work_order_id for update;
  if v_wo.id is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if not private.mizan_can_write_project(v_wo.project_id,'maintenance_work_orders','update') then raise exception 'WORK_ORDER_UPDATE_FORBIDDEN'; end if;
  if v_wo.status in ('completed','closed') then raise exception 'COMPLETED_WORK_ORDER_IMMUTABLE'; end if;
  if p_status='in_progress' and nullif(trim(coalesce(v_wo.assigned_to,'')),'') is null then raise exception 'WORK_ORDER_MUST_BE_ASSIGNED'; end if;
  update public.maintenance_work_orders set status=p_status,notes=case when p_notes is not null then nullif(trim(p_notes),'') else notes end where id=p_work_order_id returning * into v_wo;
  perform private.mizan_write_audit(v_wo.project_id,'WORK_ORDER_STATUS_CHANGED','maintenance_work_order',v_wo.id,null,jsonb_build_object('status',p_status),null,'success');
  return v_wo;
end; $$;
revoke all on function public.mizan_update_work_order_status(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.mizan_update_work_order_status(uuid,text,text) to authenticated;

create or replace function public.mizan_update_fault_status(p_fault_id uuid,p_status text,p_resolution_notes text default null)
returns public.faults language plpgsql security definer set search_path=''
as $$
declare v_fault public.faults; v_old text; v_role text; v_wo_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_fault from public.faults where id=p_fault_id for update;
  if v_fault.id is null then raise exception 'FAULT_NOT_FOUND'; end if;
  if not private.mizan_can_write_project(v_fault.project_id,'faults','update') then raise exception 'FAULT_UPDATE_FORBIDDEN'; end if;
  v_old:=v_fault.status; v_role:=private.mizan_user_role();
  if p_status not in ('reported','verified','in_progress','resolved','closed') then raise exception 'INVALID_FAULT_STATUS'; end if;
  if p_status='closed' and not (v_role='project_manager' or private.mizan_is_platform_admin()) then raise exception 'FAULT_CLOSURE_FORBIDDEN'; end if;
  select wo.status into v_wo_status from public.maintenance_work_orders wo where wo.fault_id=v_fault.id order by wo.created_at desc limit 1;
  if v_wo_status is not null and p_status='resolved' and v_wo_status <> 'completed' then raise exception 'FAULT_WORK_ORDER_MUST_BE_COMPLETED'; end if;
  if v_wo_status is not null and p_status='closed' and v_wo_status <> 'closed' then raise exception 'FAULT_WORK_ORDER_MUST_BE_CLOSED'; end if;
  if p_status='closed' and v_old <> 'resolved' then raise exception 'FAULT_MUST_BE_RESOLVED_BEFORE_CLOSURE'; end if;
  update public.faults set status=p_status,verified_at=case when p_status='verified' and verified_at is null then now() else verified_at end,resolved_at=case when p_status='resolved' and resolved_at is null then now() when p_status in ('reported','verified','in_progress') then null else resolved_at end,resolution_notes=case when p_resolution_notes is not null then nullif(trim(p_resolution_notes),'') else resolution_notes end where id=p_fault_id returning * into v_fault;
  return v_fault;
end; $$;
revoke all on function public.mizan_update_fault_status(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.mizan_update_fault_status(uuid,text,text) to authenticated;

create or replace function public.mizan_monthly_maintenance_report(p_project_id uuid,p_month date)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_start date:=date_trunc('month',p_month)::date; v_end date:=(date_trunc('month',p_month)+interval '1 month')::date; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_month is null then raise exception 'REPORT_MONTH_REQUIRED'; end if;
  if not private.mizan_can_access_project(p_project_id) then raise exception 'REPORT_PROJECT_FORBIDDEN'; end if;
  with wo as (select * from public.maintenance_work_orders where project_id=p_project_id and created_at>=v_start and created_at<v_end), faults as (select * from public.faults where project_id=p_project_id and reported_at>=v_start and reported_at<v_end)
  select jsonb_build_object(
    'project_id',p_project_id,'period_start',v_start,'period_end',(v_end-1),
    'work_orders_created',(select count(*) from wo),
    'work_orders_completed',(select count(*) from wo where completed_date>=v_start and completed_date<v_end),
    'work_orders_closed',(select count(*) from wo where status='closed'),
    'work_orders_open_at_end',(select count(*) from public.maintenance_work_orders x where x.project_id=p_project_id and x.created_at<v_end and x.status in ('open','in_progress','review_required','completed')),
    'faults_reported',(select count(*) from faults),
    'total_maintenance_cost',coalesce((select sum(coalesce(cost,0)) from wo where completed_date>=v_start and completed_date<v_end),0),
    'total_downtime_hours',coalesce((select sum(coalesce(downtime_hours,0)) from wo where completed_date>=v_start and completed_date<v_end),0),
    'average_resolution_hours',(select round(avg(extract(epoch from (completed_date-created_at))/3600.0)::numeric,2) from wo where completed_date is not null and completed_date>=v_start and completed_date<v_end),
    'by_priority',coalesce((select jsonb_object_agg(priority,cnt) from (select coalesce(priority,'unknown') priority,count(*) cnt from wo group by priority)s),'{}'::jsonb),
    'by_type',coalesce((select jsonb_object_agg(type,cnt) from (select coalesce(type,'unknown') type,count(*) cnt from wo group by type)s),'{}'::jsonb),
    'by_status',coalesce((select jsonb_object_agg(status,cnt) from (select coalesce(status,'unknown') status,count(*) cnt from wo group by status)s),'{}'::jsonb)
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.mizan_monthly_maintenance_report(uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.mizan_monthly_maintenance_report(uuid,date) to authenticated;
