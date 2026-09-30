-- Correct monthly maintenance accounting and closure lineage.
alter table public.maintenance_work_orders
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id);

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
  update public.maintenance_work_orders set status='closed',closed_at=coalesce(closed_at,now()),closed_by=coalesce(closed_by,auth.uid()),notes=case when p_notes is not null then nullif(trim(p_notes),'') else notes end where id=p_work_order_id returning * into v_wo;
  if v_wo.fault_id is not null then update public.faults set status='closed',resolved_at=coalesce(resolved_at,coalesce(v_wo.completed_date,now())),resolution_notes=coalesce(nullif(trim(p_notes),''),resolution_notes) where id=v_wo.fault_id and status <> 'closed'; end if;
  perform private.mizan_write_audit(v_wo.project_id,'WORK_ORDER_CLOSED','maintenance_work_order',v_wo.id,null,jsonb_build_object('work_order_number',v_wo.work_order_number,'closed_at',v_wo.closed_at,'closed_by',v_wo.closed_by),null,'success');
  return v_wo;
end; $$;
revoke all on function public.mizan_close_work_order(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.mizan_close_work_order(uuid,text) to authenticated;

create or replace function public.mizan_monthly_maintenance_report(p_project_id uuid,p_month date)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_start date:=date_trunc('month',p_month)::date; v_end date:=(date_trunc('month',p_month)+interval '1 month')::date; v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_month is null then raise exception 'REPORT_MONTH_REQUIRED'; end if;
  if not private.mizan_can_access_project(p_project_id) then raise exception 'REPORT_PROJECT_FORBIDDEN'; end if;
  with created_wo as (select * from public.maintenance_work_orders where project_id=p_project_id and created_at>=v_start and created_at<v_end),
  completed_wo as (select * from public.maintenance_work_orders where project_id=p_project_id and completed_date>=v_start and completed_date<v_end),
  closed_wo as (select * from public.maintenance_work_orders where project_id=p_project_id and closed_at>=v_start and closed_at<v_end),
  faults as (select * from public.faults where project_id=p_project_id and reported_at>=v_start and reported_at<v_end)
  select jsonb_build_object(
    'project_id',p_project_id,'period_start',v_start,'period_end',(v_end-1),
    'work_orders_created',(select count(*) from created_wo),
    'work_orders_completed',(select count(*) from completed_wo),
    'work_orders_closed',(select count(*) from closed_wo),
    'work_orders_open_at_end',(select count(*) from public.maintenance_work_orders x where x.project_id=p_project_id and x.created_at<v_end and x.status in ('open','in_progress','review_required')),
    'faults_reported',(select count(*) from faults),
    'total_maintenance_cost',coalesce((select sum(coalesce(cost,0)) from completed_wo),0),
    'total_downtime_hours',coalesce((select sum(coalesce(downtime_hours,0)) from completed_wo),0),
    'average_resolution_hours',(select round(avg(extract(epoch from (completed_date-created_at))/3600.0)::numeric,2) from completed_wo where completed_date is not null),
    'by_priority',coalesce((select jsonb_object_agg(priority,cnt) from (select coalesce(priority,'unknown') priority,count(*) cnt from created_wo group by priority)s),'{}'::jsonb),
    'by_type',coalesce((select jsonb_object_agg(type,cnt) from (select coalesce(type,'unknown') type,count(*) cnt from created_wo group by type)s),'{}'::jsonb),
    'by_status',coalesce((select jsonb_object_agg(status,cnt) from (select coalesce(status,'unknown') status,count(*) cnt from created_wo group by status)s),'{}'::jsonb)
  ) into v_result;
  return v_result;
end; $$;
revoke all on function public.mizan_monthly_maintenance_report(uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.mizan_monthly_maintenance_report(uuid,date) to authenticated;
