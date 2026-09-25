BEGIN;

SELECT plan(15);

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''assets''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''assets''::text, ''update''::text)%',
  'assets UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='assets' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''customers''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''customers''::text, ''update''::text)%',
  'customers UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''faults''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''faults''::text, ''update''::text)%',
  'faults UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='faults' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''field_tasks''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''field_tasks''::text, ''update''::text)%',
  'field_tasks UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='field_tasks' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''invoices''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''invoices''::text, ''update''::text)%',
  'invoices UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''kpi_snapshots''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''kpi_snapshots''::text, ''update''::text)%',
  'kpi_snapshots UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='kpi_snapshots' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''maintenance_work_orders''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''maintenance_work_orders''::text, ''update''::text)%',
  'maintenance UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_work_orders' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''meter_readings''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''meter_readings''::text, ''update''::text)%',
  'meter_readings UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='meter_readings' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''meters''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''meters''::text, ''update''::text)%',
  'meters UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='meters' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''notifications''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''notifications''::text, ''update''::text)%',
  'notifications UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''payments''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''payments''::text, ''update''::text)%',
  'payments UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''pumps''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''pumps''::text, ''update''::text)%',
  'pumps UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='pumps' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''tanks''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''tanks''::text, ''update''::text)%',
  'tanks UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='tanks' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''tariffs''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''tariffs''::text, ''update''::text)%',
  'tariffs UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='tariffs' AND policyname='mizan_tenant_update';

SELECT ok(qual LIKE '%mizan_can_write_project(project_id, ''wells''::text, ''update''::text)%'
  AND with_check LIKE '%mizan_can_write_project(project_id, ''wells''::text, ''update''::text)%',
  'wells UPDATE is role/write bounded')
FROM pg_policies WHERE schemaname='public' AND tablename='wells' AND policyname='mizan_tenant_update';

SELECT * FROM finish();
ROLLBACK;
