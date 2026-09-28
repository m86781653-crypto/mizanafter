alter table public.customers alter column household_members set default 0;
update public.customers set household_members = 0 where household_members is null;

create or replace function public.mizan_create_customer_with_meter(
  p_project_id uuid,
  p_customer_name text,
  p_phone text default null,
  p_address text default null,
  p_customer_type text default 'residential',
  p_customer_status text default 'active',
  p_household_members integer default 0,
  p_connection_date date default null,
  p_notes text default null,
  p_meter_serial_number text default null,
  p_meter_type text default 'mechanical',
  p_meter_size_mm integer default null,
  p_meter_status text default 'active'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer public.customers; v_meter public.meters;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_customer_name,'')), '') is null then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  if p_household_members is null or p_household_members < 0 then raise exception 'INVALID_HOUSEHOLD_MEMBERS'; end if;
  if p_meter_type not in ('mechanical','digital','ultrasonic') then raise exception 'INVALID_METER_TYPE'; end if;
  if p_meter_status not in ('active','inactive','faulty','replaced') then raise exception 'INVALID_METER_STATUS'; end if;
  if not private.mizan_can_write_project(p_project_id,'customers','insert') then raise exception 'CUSTOMER_WRITE_FORBIDDEN'; end if;
  if not private.mizan_can_write_project(p_project_id,'meters','insert') then raise exception 'METER_WRITE_FORBIDDEN'; end if;
  insert into public.customers(project_id,name_ar,phone,address,customer_type,status,household_members,connection_date,notes)
  values(p_project_id,trim(p_customer_name),nullif(trim(p_phone),''),nullif(trim(p_address),''),p_customer_type,p_customer_status,p_household_members,p_connection_date,nullif(trim(p_notes),'')) returning * into v_customer;
  insert into public.meters(project_id,customer_id,serial_number,meter_type,size_mm,status)
  values(p_project_id,v_customer.id,nullif(trim(p_meter_serial_number),''),p_meter_type,p_meter_size_mm,p_meter_status) returning * into v_meter;
  return jsonb_build_object('customer',to_jsonb(v_customer),'meter',to_jsonb(v_meter));
end; $$;

revoke all on function public.mizan_create_customer_with_meter(uuid,text,text,text,text,text,integer,date,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.mizan_create_customer_with_meter(uuid,text,text,text,text,text,integer,date,text,text,text,integer,text) to authenticated;