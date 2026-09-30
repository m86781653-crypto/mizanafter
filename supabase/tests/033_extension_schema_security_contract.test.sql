begin;
select plan(9);

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

select is(has_table_privilege('anon','public.spatial_ref_sys','SELECT'),false,'anon cannot select spatial_ref_sys');
select is(has_table_privilege('anon','public.spatial_ref_sys','INSERT'),false,'anon cannot insert spatial_ref_sys');
select is(has_table_privilege('anon','public.spatial_ref_sys','UPDATE'),false,'anon cannot update spatial_ref_sys');
select is(has_table_privilege('authenticated','public.spatial_ref_sys','SELECT'),false,'authenticated cannot select spatial_ref_sys');
select is(has_table_privilege('authenticated','public.spatial_ref_sys','INSERT'),false,'authenticated cannot insert spatial_ref_sys');
select is(has_table_privilege('authenticated','public.spatial_ref_sys','UPDATE'),false,'authenticated cannot update spatial_ref_sys');

select * from finish();
rollback;
