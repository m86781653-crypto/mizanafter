create or replace view public.mizan_water_balance
with (security_invoker=true)
as
with production as (
  select c.project_id,c.stopped_at::date as period_date,coalesce(sum(c.production_m3) filter (where c.status='completed'),0) production_m3
  from public.pump_operation_cycles c group by c.project_id,c.stopped_at::date
), consumption as (
  select r.project_id,r.reading_date::date as period_date,coalesce(sum(r.consumption) filter (where r.quality_review_status in ('not_required','confirmed','accepted','approved')),0) recorded_consumption_m3
  from public.meter_readings r group by r.project_id,r.reading_date::date
), periods as (
  select project_id,period_date from production union select project_id,period_date from consumption
)
select p.project_id,p.period_date,coalesce(pr.production_m3,0) production_m3,coalesce(c.recorded_consumption_m3,0) recorded_consumption_m3,
coalesce(pr.production_m3,0)-coalesce(c.recorded_consumption_m3,0) unaccounted_gap_m3
from periods p left join production pr using(project_id,period_date) left join consumption c using(project_id,period_date);

create or replace function public.mizan_operational_report(p_project_id uuid,p_period_start date,p_period_end date)
returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare v_start timestamptz;v_end timestamptz;v_result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_project_id is null or p_period_start is null or p_period_end is null then raise exception 'REPORT_PARAMETERS_REQUIRED'; end if;
 if p_period_end<=p_period_start then raise exception 'REPORT_PERIOD_INVALID'; end if;
 if not private.mizan_can_access_project(p_project_id) then raise exception 'REPORT_PROJECT_FORBIDDEN'; end if;
 v_start:=p_period_start::timestamptz;v_end:=p_period_end::timestamptz;
 select jsonb_build_object(
 'project_id',p_project_id,'period_start',p_period_start,'period_end',p_period_end-1,
 'customer_count',(select count(*) from public.customers c where c.project_id=p_project_id),
 'meter_count',(select count(*) from public.meters m where m.project_id=p_project_id),
 'invoice_count',(select count(*) from public.invoices i where i.project_id=p_project_id and i.issue_date>=v_start and i.issue_date<v_end),
 'invoiced_amount',coalesce((select sum(coalesce(i.grand_total,0)) from public.invoices i where i.project_id=p_project_id and i.issue_date>=v_start and i.issue_date<v_end),0),
 'approved_collected_amount',coalesce((select sum(coalesce(p.amount,0)) from public.payments p where p.project_id=p_project_id and p.approval_status='approved' and p.payment_date>=v_start and p.payment_date<v_end),0),
 'current_outstanding_amount',coalesce((select sum(greatest(coalesce(i.balance,0),0)) from public.invoices i where i.project_id=p_project_id and i.status<>'paid'),0),
 'reading_count',(select count(*) from public.meter_readings r where r.project_id=p_project_id and r.reading_date>=v_start and r.reading_date<v_end),
 'reading_anomaly_count',(select count(*) from public.meter_readings r where r.project_id=p_project_id and r.reading_date>=v_start and r.reading_date<v_end and coalesce(r.anomaly_flag,false)),
 'accepted_reading_count',(select count(*) from public.meter_readings r where r.project_id=p_project_id and r.reading_date>=v_start and r.reading_date<v_end and r.quality_review_status in ('not_required','confirmed','accepted','approved')),
 'production_m3',coalesce((select sum(coalesce(c.production_m3,0)) from public.pump_operation_cycles c where c.project_id=p_project_id and c.status='completed' and c.stopped_at>=v_start and c.stopped_at<v_end),0),
 'recorded_consumption_m3',coalesce((select sum(coalesce(i.consumption_m3,0)) from public.invoices i where i.project_id=p_project_id and i.billing_period_end>=p_period_start and i.billing_period_end<p_period_end),0),
 'water_balance_gap_m3',
 coalesce((select sum(coalesce(c.production_m3,0)) from public.pump_operation_cycles c where c.project_id=p_project_id and c.status='completed' and c.stopped_at>=v_start and c.stopped_at<v_end),0)
 - coalesce((select sum(coalesce(i.consumption_m3,0)) from public.invoices i where i.project_id=p_project_id and i.billing_period_end>=p_period_start and i.billing_period_end<p_period_end),0),
 'water_balance_has_production',exists(select 1 from public.pump_operation_cycles c where c.project_id=p_project_id and c.status='completed' and c.stopped_at>=v_start and c.stopped_at<v_end),
 'water_balance_has_consumption',exists(select 1 from public.invoices i where i.project_id=p_project_id and i.billing_period_end>=p_period_start and i.billing_period_end<p_period_end),
 'fault_count',(select count(*) from public.faults f where f.project_id=p_project_id and f.reported_at>=v_start and f.reported_at<v_end),
 'open_fault_count',(select count(*) from public.faults f where f.project_id=p_project_id and f.status not in ('closed','resolved')),
 'maintenance_created_count',(select count(*) from public.maintenance_work_orders w where w.project_id=p_project_id and w.created_at>=v_start and w.created_at<v_end),
 'maintenance_completed_count',(select count(*) from public.maintenance_work_orders w where w.project_id=p_project_id and w.completed_date>=v_start and w.completed_date<v_end),
 'maintenance_closed_count',(select count(*) from public.maintenance_work_orders w where w.project_id=p_project_id and w.closed_at>=v_start and w.closed_at<v_end),
 'maintenance_cost',coalesce((select sum(coalesce(w.cost,0)) from public.maintenance_work_orders w where w.project_id=p_project_id and w.completed_date>=v_start and w.completed_date<v_end),0),
 'maintenance_downtime_hours',coalesce((select sum(coalesce(w.downtime_hours,0)) from public.maintenance_work_orders w where w.project_id=p_project_id and w.completed_date>=v_start and w.completed_date<v_end),0),
 'open_maintenance_count',(select count(*) from public.maintenance_work_orders w where w.project_id=p_project_id and w.created_at<v_end and w.status in ('open','in_progress','review_required')),
 'service_interruption_count',(select count(*) from public.service_interruptions s where s.project_id=p_project_id and s.started_at>=v_start and s.started_at<v_end),
 'open_service_interruption_count',(select count(*) from public.service_interruptions s where s.project_id=p_project_id and s.status not in ('restored','closed')),
 'data_quality',jsonb_build_object('period_is_valid',true,'water_balance_is_comparable',
   exists(select 1 from public.pump_operation_cycles c where c.project_id=p_project_id and c.status='completed' and c.stopped_at>=v_start and c.stopped_at<v_end)
   and exists(select 1 from public.invoices i where i.project_id=p_project_id and i.billing_period_end>=p_period_start and i.billing_period_end<p_period_end))
 ) into v_result;
 return v_result;
end;$function$;