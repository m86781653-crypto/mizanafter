-- Structural privileges bypass RLS and must not be inherited by browser roles.
do $$
declare r record;
begin
  for r in
    select distinct table_schema, table_name
    from information_schema.role_table_grants
    where grantee in ('public','anon','authenticated')
      and table_schema='public'
      and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')
  loop
    execute format(
      'revoke truncate, trigger, references on table %I.%I from public, anon, authenticated',
      r.table_schema, r.table_name
    );
  end loop;
end $$;
