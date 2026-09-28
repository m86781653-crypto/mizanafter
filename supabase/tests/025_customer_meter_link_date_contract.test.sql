-- Customer + meter creation contract: link date is system-controlled.

do $$
declare
  v_new_sig text := 'public.mizan_create_customer_with_meter(uuid,text,text,text,text,text,integer,text,text,text,integer,text)';
  v_old_sig text := 'public.mizan_create_customer_with_meter(uuid,text,text,text,text,text,integer,date,text,text,text,integer,text)';
  v_def text;
begin
  if to_regprocedure(v_new_sig) is null then
    raise exception 'AUTOMATIC_CUSTOMER_METER_RPC_MISSING';
  end if;

  if to_regprocedure(v_old_sig) is not null then
    raise exception 'MANUAL_CONNECTION_DATE_RPC_OVERLOAD_STILL_EXISTS';
  end if;

  select pg_get_functiondef(to_regprocedure(v_new_sig)) into v_def;

  if position('current_date' in v_def) = 0 then
    raise exception 'CUSTOMER_CONNECTION_DATE_IS_NOT_SYSTEM_GENERATED';
  end if;

  if position('p_connection_date' in v_def) > 0 then
    raise exception 'MANUAL_CONNECTION_DATE_PARAMETER_STILL_PRESENT';
  end if;

  if not has_function_privilege('authenticated', v_new_sig, 'execute') then
    raise exception 'AUTOMATIC_CUSTOMER_METER_RPC_NOT_EXECUTABLE_BY_AUTHENTICATED';
  end if;
end $$;
