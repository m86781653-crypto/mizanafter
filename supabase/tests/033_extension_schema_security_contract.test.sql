begin;
select plan(3);

select is(
  (select n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='btree_gist'),
  'extensions',
  'btree_gist is installed outside public'
);

select is(
  (select count(*)::integer from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='btree_gist' and n.nspname='public'),
  0,
  'btree_gist is not installed in public'
);

select is(
  (select count(*)::integer from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis' and n.nspname='public'),
  1,
  'PostGIS relocation remains explicit and separately governed'
);

select * from finish();
rollback;
