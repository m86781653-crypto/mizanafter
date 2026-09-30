create or replace view public.mizan_water_balance
with (security_invoker=true)
as
with production as (
  select c.project_id,c.stopped_at::date as period_date,
         coalesce(sum(c.production_m3) filter (where c.status='completed'),0) as production_m3
  from public.pump_operation_cycles c
  group by c.project_id,c.stopped_at::date
), consumption as (
  select r.project_id,r.reading_date::date as period_date,
         coalesce(sum(r.consumption) filter (where r.quality_review_status in ('not_required','confirmed','accepted','approved')),0) as recorded_consumption_m3
  from public.meter_readings r
  group by r.project_id,r.reading_date::date
), periods as (
  select project_id,period_date from production
  union
  select project_id,period_date from consumption
)
select p.project_id,p.period_date,
       coalesce(pr.production_m3,0) as production_m3,
       coalesce(c.recorded_consumption_m3,0) as recorded_consumption_m3,
       coalesce(pr.production_m3,0)-coalesce(c.recorded_consumption_m3,0) as unaccounted_gap_m3
from periods p
left join production pr using(project_id,period_date)
left join consumption c using(project_id,period_date);