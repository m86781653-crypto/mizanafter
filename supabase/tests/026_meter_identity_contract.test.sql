-- Meter identity contract: the human-entered serial is the authoritative meter identity.

do $$
declare
  v_def text;
  v_index_exists boolean;
  v_constraint_exists boolean;
begin
  select pg_get_functiondef(to_regprocedure('public.mizan_create_customer_with_meter(uuid,text,text,text,text,text,integer,text,text,text,integer,text)')) into v_def;

  if v_def is null then
    raise exception 'CUSTOMER_METER_RPC_MISSING';
  end if;

  if position('p_meter_serial_number' in v_def) = 0 then
    raise exception 'METER_SERIAL_IDENTITY_INPUT_MISSING';
  end if;

  if position('serial_number' in v_def) = 0 then
    raise exception 'METER_SERIAL_IDENTITY_NOT_PERSISTED';
  end if;

  select to_regclass('public.ux_meters_project_serial_number') is not null into v_index_exists;
  if not v_index_exists then
    raise exception 'METER_SERIAL_UNIQUENESS_INDEX_MISSING';
  end if;

  select exists (
    select 1
    from pg_constraint
    where conrelid = 'public.meters'::regclass
      and conname = 'meters_active_serial_required'
  ) into v_constraint_exists;
  if not v_constraint_exists then
    raise exception 'ACTIVE_METER_SERIAL_REQUIRED_CONSTRAINT_MISSING';
  end if;
end $$;
