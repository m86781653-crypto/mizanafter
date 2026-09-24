-- Runtime security contract: critical tables must not expose destructive/structural privileges to API roles.
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from information_schema.role_table_grants
  where table_schema='public'
    and grantee in ('anon','authenticated')
    and table_name in ('meter_readings','meters','invoices','payments','audit_logs','seq_counters','project_seq_counters')
    and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES');

  if v_bad <> 0 then
    raise exception 'Critical API privilege regression: % forbidden grants remain', v_bad;
  end if;

  select count(*) into v_bad
  from information_schema.role_table_grants
  where table_schema='public'
    and grantee in ('anon','authenticated')
    and table_name in ('seq_counters','project_seq_counters')
    and privilege_type='SELECT';

  if v_bad <> 0 then
    raise exception 'Sequence counter SELECT privilege regression: % grants remain', v_bad;
  end if;
end $$;
