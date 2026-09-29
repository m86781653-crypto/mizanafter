create or replace function public.mizan_report_service_interruption(
  p_project_id uuid, p_interruption_type text, p_severity text default 'medium', p_description text default null,
  p_cause_category text default null, p_cause_description text default null, p_started_at timestamptz default now(),
  p_affected_subscribers integer default 0, p_estimated_water_loss_m3 numeric default 0
) returns public.service_interruptions language plpgsql security definer set search_path=''
as $$
declare v_row public.service_interruptions;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not private.mizan_can_write_project(p_project_id,'service_interruptions','insert') then raise exception 'INTERRUPTION_CREATE_FORBIDDEN'; end if;
 if p_interruption_type not in ('service_stop','pressure_drop','production_stop','planned_shutdown','emergency_shutdown') then raise exception 'INVALID_INTERRUPTION_TYPE'; end if;
 if p_severity not in ('low','medium','high','critical') then raise exception 'INVALID_SEVERITY'; end if;
 if p_affected_subscribers < 0 or p_estimated_water_loss_m3 < 0 then raise exception 'INVALID_IMPACT_VALUES'; end if;
 insert into public.service_interruptions(project_id,interruption_type,severity,status,description,cause_category,cause_description,started_at,affected_subscribers,estimated_water_loss_m3,reported_by)
 values(p_project_id,p_interruption_type,p_severity,'open',nullif(trim(p_description),''),nullif(trim(p_cause_category),''),nullif(trim(p_cause_description),''),coalesce(p_started_at,now()),p_affected_subscribers,p_estimated_water_loss_m3,auth.uid())
 returning * into v_row;
 return v_row;
end; $$;
grant execute on function public.mizan_report_service_interruption(uuid,text,text,text,text,text,timestamptz,integer,numeric) to authenticated;