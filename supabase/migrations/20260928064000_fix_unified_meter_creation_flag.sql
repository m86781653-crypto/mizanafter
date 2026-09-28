drop function if exists public.mizan_register_subscriber(uuid,text,text,text,text,text,date,integer,text,text,text,integer,text,date);
create or replace function public.mizan_register_subscriber(
  p_project_id uuid,p_name_ar text,p_phone text default null,p_address text default null,p_customer_type text default 'residential',
  p_status text default 'active',p_connection_date date default null,p_household_members integer default 1,p_notes text default null,
  p_create_meter boolean default true,p_meter_serial_number text default null,p_meter_type text default 'mechanical',
  p_meter_size_mm integer default null,p_meter_status text default 'active',p_meter_installation_date date default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_customer public.customers; v_meter public.meters;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if nullif(trim(coalesce(p_name_ar,'')),'') is null then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  if p_household_members is null or p_household_members < 1 then raise exception 'INVALID_HOUSEHOLD_MEMBERS'; end if;
  if not private.mizan_can_write_project(p_project_id,'customers','insert') then raise exception 'CUSTOMER_WRITE_FORBIDDEN'; end if;
  if p_create_meter and not private.mizan_can_write_project(p_project_id,'meters','insert') then raise exception 'METER_WRITE_FORBIDDEN'; end if;
  insert into public.customers(project_id,name_ar,phone,address,customer_type,status,connection_date,household_members,notes)
  values(p_project_id,trim(p_name_ar),nullif(trim(p_phone),''),nullif(trim(p_address),''),
    coalesce(nullif(trim(p_customer_type),''),'residential'),coalesce(nullif(trim(p_status),''),'active'),
    p_connection_date,p_household_members,nullif(trim(p_notes),'')) returning * into v_customer;
  if p_create_meter then
    insert into public.meters(project_id,customer_id,serial_number,meter_type,size_mm,status,installation_date)
    values(p_project_id,v_customer.id,nullif(trim(p_meter_serial_number),''),
      coalesce(nullif(trim(p_meter_type),''),'mechanical'),p_meter_size_mm,
      coalesce(nullif(trim(p_meter_status),''),'active'),p_meter_installation_date) returning * into v_meter;
  end if;
  return jsonb_build_object('customer',to_jsonb(v_customer),'meter',case when v_meter.id is null then null else to_jsonb(v_meter) end);
end; $$;
revoke all on function public.mizan_register_subscriber(uuid,text,text,text,text,text,date,integer,text,boolean,text,text,integer,text,date) from public,anon,authenticated;
grant execute on function public.mizan_register_subscriber(uuid,text,text,text,text,text,date,integer,text,boolean,text,text,integer,text,date) to authenticated;