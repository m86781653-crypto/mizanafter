BEGIN;

SELECT plan(15);

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'assets','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'assets','update')%$$,
  'assets UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='assets' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'customers','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'customers','update')%$$,
  'customers UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'faults','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'faults','update')%$$,
  'faults UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='faults' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'field_tasks','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'field_tasks','update')%$$,
  'field_tasks UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='field_tasks' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'invoices','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'invoices','update')%$$,
  'invoices UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'kpi_snapshots','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'kpi_snapshots','update')%$$,
  'kpi_snapshots UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='kpi_snapshots' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'maintenance_work_orders','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'maintenance_work_orders','update')%$$,
  'maintenance_work_orders UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_work_orders' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'meter_readings','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'meter_readings','update')%$$,
  'meter_readings UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='meter_readings' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'meters','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'meters','update')%$$,
  'meters UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='meters' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'notifications','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'notifications','update')%$$,
  'notifications UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'payments','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'payments','update')%$$,
  'payments UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'pumps','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'pumps','update')%$$,
  'pumps UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='pumps' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'tanks','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'tanks','update')%$$,
  'tanks UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='tanks' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'tariffs','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'tariffs','update')%$$,
  'tariffs UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='tariffs' AND policyname='mizan_tenant_update';

SELECT ok(
  replace(replace(coalesce(qual,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'wells','update')%$$
  AND replace(replace(coalesce(with_check,''),'::text',''),' ','') LIKE $$%mizan_can_write_project(project_id,'wells','update')%$$,
  'wells UPDATE is role/write bounded'
)
FROM pg_policies WHERE schemaname='public' AND tablename='wells' AND policyname='mizan_tenant_update';

SELECT * FROM finish();
ROLLBACK;
