/*
# MIZAN production regression contract
Static pgTAP contract for migration review. Runtime execution requires a Supabase
test database; this file intentionally does not claim runtime execution.
*/
SELECT plan(12);

SELECT has_table('public','tenants','tenant hierarchy exists');
SELECT has_table('public','mizan_permissions','permission catalogue exists');
SELECT has_table('public','mizan_role_permissions','role permission mapping exists');
SELECT has_column('public','profiles','tenant_id','profiles are tenant scoped');
SELECT has_column('public','projects','tenant_id','projects are tenant scoped');
SELECT has_column('public','meter_readings','business_date','reading business date exists');
SELECT has_index('public','meter_readings','ux_meter_readings_meter_business_day','duplicate normal reading guard exists');
SELECT has_function('public','mrx_capture_meter_reading','MRX server capture exists');
SELECT has_function('public','mizan_create_invoice','server invoice calculation exists');
SELECT has_function('public','mizan_record_payment','server collection transaction exists');
SELECT has_table('public','audit_logs','existing audit table retained');
SELECT has_table('public','invoices','existing invoice table retained');

SELECT * FROM finish();
