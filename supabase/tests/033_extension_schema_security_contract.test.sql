begin;
select plan(25);

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


-- API roles must not call PostGIS extent helpers directly.
select ok(
  not has_function_privilege('anon', 'public.st_estimatedextent(text,text)', 'EXECUTE'),
  'anon cannot execute the two-argument PostGIS extent helper'
);
select ok(
  not has_function_privilege('authenticated', 'public.st_estimatedextent(text,text)', 'EXECUTE'),
  'authenticated cannot execute the two-argument PostGIS extent helper'
);
select ok(
  not has_function_privilege('anon', 'public.st_estimatedextent(text,text,text)', 'EXECUTE'),
  'anon cannot execute the three-argument PostGIS extent helper'
);
select ok(
  not has_function_privilege('authenticated', 'public.st_estimatedextent(text,text,text)', 'EXECUTE'),
  'authenticated cannot execute the three-argument PostGIS extent helper'
);
select ok(
  not has_function_privilege('anon', 'public.st_estimatedextent(text,text,text,boolean)', 'EXECUTE'),
  'anon cannot execute the four-argument PostGIS extent helper'
);
select ok(
  not has_function_privilege('authenticated', 'public.st_estimatedextent(text,text,text,boolean)', 'EXECUTE'),
  'authenticated cannot execute the four-argument PostGIS extent helper'
);

-- Sequence allocation is mediated by governed RPCs, not direct table access.
select ok(not has_table_privilege('anon', 'public.seq_counters', 'SELECT'), 'anon cannot select sequence counters');
select ok(not has_table_privilege('anon', 'public.seq_counters', 'INSERT'), 'anon cannot insert sequence counters');
select ok(not has_table_privilege('anon', 'public.seq_counters', 'UPDATE'), 'anon cannot update sequence counters');
select ok(not has_table_privilege('anon', 'public.seq_counters', 'DELETE'), 'anon cannot delete sequence counters');
select ok(not has_table_privilege('authenticated', 'public.seq_counters', 'SELECT'), 'authenticated cannot select sequence counters');
select ok(not has_table_privilege('authenticated', 'public.seq_counters', 'INSERT'), 'authenticated cannot insert sequence counters');
select ok(not has_table_privilege('authenticated', 'public.seq_counters', 'UPDATE'), 'authenticated cannot update sequence counters');
select ok(not has_table_privilege('authenticated', 'public.seq_counters', 'DELETE'), 'authenticated cannot delete sequence counters');

select ok(not has_table_privilege('anon', 'public.project_seq_counters', 'SELECT'), 'anon cannot select project sequence counters');
select ok(not has_table_privilege('anon', 'public.project_seq_counters', 'INSERT'), 'anon cannot insert project sequence counters');
select ok(not has_table_privilege('anon', 'public.project_seq_counters', 'UPDATE'), 'anon cannot update project sequence counters');
select ok(not has_table_privilege('anon', 'public.project_seq_counters', 'DELETE'), 'anon cannot delete project sequence counters');
select ok(not has_table_privilege('authenticated', 'public.project_seq_counters', 'SELECT'), 'authenticated cannot select project sequence counters');
select ok(not has_table_privilege('authenticated', 'public.project_seq_counters', 'INSERT'), 'authenticated cannot insert project sequence counters');
select ok(not has_table_privilege('authenticated', 'public.project_seq_counters', 'UPDATE'), 'authenticated cannot update project sequence counters');
select ok(not has_table_privilege('authenticated', 'public.project_seq_counters', 'DELETE'), 'authenticated cannot delete project sequence counters');

select diag(
  'st_estimatedextent ACL diagnostics: ' ||
  coalesce((
    select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') acl=' || coalesce(p.proacl::text, '<default>'), '; ')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'st_estimatedextent'
  ), '<no functions>') ||
  '; anon inherits authenticated=' || pg_has_role('anon', 'authenticated', 'MEMBER')::text ||
  '; authenticated inherits anon=' || pg_has_role('authenticated', 'anon', 'MEMBER')::text
);

select * from finish();
rollback;
