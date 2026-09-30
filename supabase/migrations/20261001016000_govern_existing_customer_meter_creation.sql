-- Governed path for adding a meter to an existing subscriber.
-- This restores the existing UI workflow without granting direct table INSERT to authenticated clients.
create or replace function public.mizan_add_meter_to_customer(
  p_project_id uuid,
  p_customer_id uuid,
  p_meter_serial_number text,
  p_meter_type text default 'mechanical',
  p_meter_size_mm integer default null,
  p_meter_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_project_id is null or p_customer_id is null then raise exception 'METER_CUSTOMER_SCOPE_REQUIRED' using errcode='22023'; end if;
  if not private.mizan_can_write_project(p_project_id,'meters','insert') then
    raise exception 'METER_WRITE_FORBIDDEN' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.customers c
    where c.id=p_customer_id and c.project_id=p_project_id
  ) then
    raise exception 'CUSTOMER_PROJECT_SCOPE_INVALID' using errcode='22023';
  end if;
  if nullif(trim(coalesce(p_meter_serial_number,'')),'') is null and p_meter_status='active' then
    raise exception 'METER_SERIAL_REQUIRED' using errcode='22023';
  end if;
  if p_meter_type not in ('mechanical','digital','ultrasonic') then
    raise exception 'INVALID_METER_TYPE' using errcode='22023';
  end if;
  if p_meter_status not in ('active','inactive','faulty','replaced') then
    raise exception 'INVALID_METER_STATUS' using errcode='22023';
  end if;
  if p_meter_size_mm is not null and p_meter_size_mm <= 0 then
    raise exception 'INVALID_METER_SIZE' using errcode='22023';
  end if;

  insert into public.meters(
    project_id,customer_id,serial_number,meter_type,size_mm,status,installation_date
  )
  values(
    p_project_id,
    p_customer_id,
    nullif(trim(p_meter_serial_number),''),
    p_meter_type,
    p_meter_size_mm,
    p_meter_status,
    current_date
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.mizan_add_meter_to_customer(uuid,uuid,text,text,integer,text) from public,anon;
grant execute on function public.mizan_add_meter_to_customer(uuid,uuid,text,text,integer,text) to authenticated;
