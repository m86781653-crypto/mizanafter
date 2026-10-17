-- Preserve customer-linked financial history and disable destructive customer deletion.
-- Drop every permissive DELETE/ALL policy applicable to client roles, regardless of legacy policy name.
-- The UI already supports suspension/reactivation; historical records should remain traceable.
begin;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select p.polname
    from pg_policy p
    where p.polrelid = 'public.customers'::regclass
      and p.polpermissive
      and p.polcmd in ('d', '*')
      and (
        0 = any (p.polroles)
        or (select oid from pg_roles where rolname = 'anon') = any (p.polroles)
        or (select oid from pg_roles where rolname = 'authenticated') = any (p.polroles)
      )
  loop
    execute format('drop policy %I on public.customers', policy_row.polname);
  end loop;
end
$$;

alter table public.invoices
  drop constraint if exists invoices_customer_id_fkey;

alter table public.invoices
  add constraint invoices_customer_id_fkey
  foreign key (customer_id)
  references public.customers(id)
  on delete restrict;

commit;
