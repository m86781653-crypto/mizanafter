begin;
select plan(3);

select ok(
  not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'customers'
      and p.polpermissive
      and p.polcmd in ('d', '*')
      and (
        0 = any (p.polroles)
        or (select oid from pg_roles where rolname = 'anon') = any (p.polroles)
        or (select oid from pg_roles where rolname = 'authenticated') = any (p.polroles)
      )
  ),
  'no permissive customer DELETE policy applies to PUBLIC, anon, or authenticated'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and conname = 'invoices_customer_id_fkey'
      and contype = 'f'
  ),
  'r',
  'invoice history restricts deletion of its customer'
);

select ok(
  exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'customers'
      and p.polcmd = 'w'
  ),
  'customer updates remain governed by the existing update policy'
);

select * from finish();
rollback;
