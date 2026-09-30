create unique index if not exists water_production_meters_project_serial_uq on public.water_production_meters(project_id,serial_number) where serial_number is not null;

create or replace function public.mizan_register_water_production_meter(
 p_project_id uuid,p_well_id uuid,p_pump_id uuid,p_meter_number text,p_serial_number text default null,
 p_initial_reading numeric default 0,p_installed_at date default null,p_notes text default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_uid uuid:=auth.uid();v_id uuid;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if private.mizan_user_role()<>'project_manager' or not private.mizan_has_permission('project.manage') then raise exception 'PRODUCTION_METER_SETUP_FORBIDDEN' using errcode='42501'; end if;
 if not private.mizan_can_access_project(p_project_id) then raise exception 'PROJECT_ACCESS_DENIED' using errcode='42501'; end if;
 if nullif(trim(p_meter_number),'') is null then raise exception 'METER_NUMBER_REQUIRED' using errcode='22023'; end if;
 if nullif(trim(p_serial_number),'') is null then raise exception 'METER_SERIAL_REQUIRED' using errcode='22023'; end if;
 if p_initial_reading is null or p_initial_reading<0 then raise exception 'INITIAL_READING_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.wells w where w.id=p_well_id and w.project_id=p_project_id) then raise exception 'WELL_SCOPE_INVALID' using errcode='22023'; end if;
 if not exists(select 1 from public.pumps p where p.id=p_pump_id and p.project_id=p_project_id and p.well_id=p_well_id) then raise exception 'PUMP_SCOPE_INVALID' using errcode='22023'; end if;
 insert into public.water_production_meters(project_id,well_id,pump_id,meter_number,serial_number,initial_reading,installed_at,notes)
 values(p_project_id,p_well_id,p_pump_id,trim(p_meter_number),trim(p_serial_number),p_initial_reading,p_installed_at,nullif(trim(p_notes),''))
 returning id into v_id;
 return v_id;
end;$function$;

revoke execute on function public.mizan_register_water_production_meter(uuid,uuid,uuid,text,text,numeric,date,text) from public,anon;
grant execute on function public.mizan_register_water_production_meter(uuid,uuid,uuid,text,text,numeric,date,text) to authenticated;