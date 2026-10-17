# MIZAN AI — migration-history name reconciliation (diagnostic only)

**Snapshot date:** 2026-10-17  
**Repository:** `m86781653-crypto/mizanafter`, branch `main`  
**Supabase project:** `dofteozulbjwnzofcfmo`  
**Purpose:** Establish a reproducible filename/name inventory. This is **not** an applied-state equivalence determination and is **not** an authorization to apply or replay migrations.

## Method

- Enumerated SQL files in `supabase/migrations/` on `main`.
- Read migration records through the Supabase migration-history listing.
- Normalized names by removing `.sql`, leading 14-digit filename timestamps, optional numeric migration prefixes, and punctuation/case.
- Compared normalized repository basenames with normalized live migration names.
- Did not execute, replay, or modify any migration or production data.

## Results

- Repository SQL migration files: **131**
- Live migration records: **163**
- Live records whose normalized name matches a repository filename: **102**
- Unique repository migration files matched by at least one live record: **91**
- Repository files with no normalized live-name match: **40**
- Live records with no normalized repository-name match: **61**
- Normalized live names with duplicate records: **11 groups**

Name matching is many-to-many in the presence of historical duplicates. It does not establish that the SQL bodies are identical or semantically equivalent, nor does an unmatched filename prove that its migration is unapplied. Live version values and repository filename timestamps are not assumed to be comparable.

## Repository files with no normalized live-name match

- `20260919194212_001_core_schema.sql`
- `20260922131354_002_auth_and_project_isolation.sql`
- `20260923124051_003_sequences.sql`
- `20260923143121_004_project_sequences.sql`
- `20260925210000_reconcile_platform_admin_role_model.sql`
- `20260925212500_restore_tenant_hierarchy_prerequisites.sql`
- `20260925213200_restore_permission_catalog.sql`
- `20260925214200_reconstruct_governed_database_objects.sql`
- `20260925214250_restore_role_catalog.sql`
- `20260925214275_restore_permission_catalog.sql`
- `20260926011000_finalize_update_write_boundaries.sql`
- `20260926180000_maintenance_work_order_governance.sql`
- `20260926200000_remove_legacy_invoice_overload.sql`
- `20260926210000_finalize_invoice_source_and_tariff_write_boundary.sql`
- `20260926230000_establish_central_governance_role_model.sql`
- `20260927223000_grant_authenticated_profile_policy_helpers.sql`
- `20260928020000_align_subtenant_operational_role_invariant.sql`
- `20260928033000_enforce_subtenant_project_profile_tenancy.sql`
- `20260928035000_finalize_private_authorization_boundary.sql`
- `20260928060000_unify_customer_meter_intake.sql`
- `20260928060100_maintenance_memo_lifecycle.sql`
- `20260928210000_fair_variable_period_billing.sql`
- `20260928211000_allow_recorded_reading_invoice_binding.sql`
- `20260928212000_billing_integrity_followup.sql`
- `20260928223000_root_security_write_boundaries.sql`
- `20260928223500_revoke_postgis_catalog_client_grants.sql`
- `20260928224000_revoke_legacy_financial_rpcs.sql`
- `20260928230000_production_fk_indexes.sql`
- `20260928231500_remove_duplicate_indexes_and_profile_policy.sql`
- `20260928232000_index_private_foreign_keys.sql`
- `20260929003000_automatic_customer_meter_link_date.sql`
- `20260929010000_repair_audit_logs_user_index.sql`
- `20260929015000_repair_audit_lineage_columns.sql`
- `20260929020000_meter_reading_quality_engine.sql`
- `20260929023000_meter_reading_quality_review_workflow.sql`
- `20260929030000_meter_readings_quality_reviewed_by_index.sql`
- `20260930175500_retire_legacy_interruption_rpc_paths.sql`
- `20260930235000_revoke_public_structural_table_privileges.sql`
- `20261017170000_require_active_project_tenant_for_access.sql`
- `20261017180000_preserve_customer_financial_history.sql`

## Live records with no normalized repository-name match

- `20260924191021` — `api_privilege_hardening`
- `20260924191025` — `rls_and_query_plan_hardening`
- `20260924192155` — `lock_down_internal_auth_helpers`
- `20260924192232` — `tighten_security_definer_search_path`
- `20260924192316` — `lock_down_public_default_privileges`
- `20260924193943` — `auth_provisioning_hardening`
- `20260924194019` — `auth_provisioning_hardening_020`
- `20260924194117` — `tenant_policy_runtime_fix_021`
- `20260924194157` — `audit_writer_022`
- `20260924194332` — `audit_fk_immutability_023`
- `20260924213814` — `025_mrx_meter_identity_verification`
- `20260924214229` — `drop_legacy_mrx_capture_signature`
- `20260925134447` — `mrx_idempotency_authorization_order_027`
- `20260925134538` — `restrict_postgis_estimatedextent_rpc_surface_028`
- `20260925134551` — `remove_postgis_estimatedextent_public_execute_028_fix`
- `20260925142316` — `explicit_anon_rpc_hardening_029`
- `20260925143834` — `030_subscriber_single_page_data_model`
- `20260925144036` — `031_meter_identity_and_active_link_integrity`
- `20260925150650` — `hierarchical_tenant_governance`
- `20260925201333` — `service_interruptions_audit_timestamps`
- `20260925202453` — `032_service_interruptions_fk_indexes_and_profiles_rls_initplan`
- `20260925204926` — `lock_down_mizan_has_permission_execution`
- `20260925205337` — `critical_table_privilege_minimization_033`
- `20260925212008` — `034_lock_operational_billing_rpc_execution`
- `20260925212955` — `lock_down_postgis_estimatedextent_execution`
- `20260926151718` — `lock_down_postgis_estimatedextent_execute_final`
- `20260926152316` — `lock_down_private_trigger_helpers_execute`
- `20260926163619` — `harden_postgis_estimatedextent`
- `20260926164025` — `harden_postgis_catalog_and_index_integrity`
- `20260926171655` — `remove_legacy_invoice_overload_20260926200000`
- `20260926172130` — `finalize_invoice_source_and_tariff_write_boundary_20260926210000`
- `20260926181010` — `20260926234500_finalize_subtenant_user_claim_flow`
- `20260926181141` — `20260926235500_complete_subtenant_project_baseline_provisioning`
- `20260927190248` — `fix_profiles_self_read_for_authenticated_users`
- `20260927190409` — `restore_profiles_authenticated_select_grant`
- `20260927203014` — `fix_subtenant_provision_extension_qualification`
- `20260928134659` — `20260928062000_unified_subscriber_maintenance_workflows`
- `20260928134902` — `20260928063000_automatic_interruption_numbering`
- `20260928135219` — `20260928064000_fix_unified_meter_creation_flag`
- `20260928135631` — `20260928060000_unify_customer_meter_and_maintenance_records`
- `20260928154451` — `fair_variable_period_billing_20260928`
- `20260928154457` — `fair_variable_period_billing_20260928_v2`
- `20260928154607` — `allow_recorded_reading_invoice_binding_20260928`
- `20260928154647` — `billing_integrity_followup_20260928`
- `20260928161917` — `root_security_write_boundaries_20260928`
- `20260928161956` — `revoke_postgis_catalog_client_grants_20260928`
- `20260928162105` — `revoke_legacy_financial_rpcs_20260928`
- `20260928162200` — `production_fk_indexes_20260928`
- `20260928162453` — `remove_duplicate_indexes_and_profile_policy_20260928`
- `20260928162503` — `index_private_foreign_keys_20260928`
- `20260929142208` — `meter_reading_quality_engine_20260929020000`
- `20260929142236` — `meter_reading_quality_review_workflow_20260929023000`
- `20260929143405` — `meter_readings_quality_reviewed_by_index_20260929030000`
- `20260929145247` — `20260929160000_lock_postgis_client_surface_parity`
- `20260929145409` — `20260929160500_explicit_postgis_client_grants_lockdown`
- `20260929211752` — `revoke_anon_postgis_estimatedextent`
- `20260929215432` — `remove_public_structural_privileges_final`
- `20260929215439` — `revoke_postgis_extent_client_execution_final`
- `20260930145201` — `retire_legacy_service_interruption_rpc_paths`
- `20260930152617` — `retire_legacy_operational_rpc_paths_live`
- `20260930174339` — `align_operational_reporting_and_water_balance_semantics`

## Duplicate normalized live-name groups

- `criticaltableprivilegeminimization`: `20260924200401` (`024_critical_table_privilege_minimization`), `20260925212843` (`critical_table_privilege_minimization`)
- `enforcesubtenantoperationalroles`: `20260925201955` (`enforce_subtenant_operational_roles`), `20260925212815` (`enforce_subtenant_operational_roles`)
- `lockdownsecuritydefinerfunctionexecution`: `20260925204608` (`lock_down_security_definer_function_execution`), `20260925212832` (`lock_down_security_definer_function_execution`)
- `hardenprofileroleimmutabilityforclients`: `20260925204732` (`harden_profile_role_immutability_for_clients`), `20260925212837` (`harden_profile_role_immutability_for_clients`)
- `enforceoperationalrpcwriteboundaries`: `20260925211241` (`enforce_operational_rpc_write_boundaries`), `20260925212922` (`enforce_operational_rpc_write_boundaries`)
- `bindinvoicetomrxreading`: `20260926161627` (`bind_invoice_to_mrx_reading`), `20260926161641` (`bind_invoice_to_mrx_reading`)
- `hardenproductionmeasurementcaptureauthority`: `20260930174012` (`harden_production_measurement_capture_authority`), `20260930195012` (`20260930210000_harden_production_measurement_capture_authority`)
- `hardeninterruptionevidencefunction`: `20260930174030` (`harden_interruption_evidence_function`), `20260930195019` (`20260930210100_harden_interruption_evidence_function`)
- `hardeninterruptionevidencegrants`: `20260930174118` (`harden_interruption_evidence_grants`), `20260930195026` (`20260930210200_harden_interruption_evidence_grants`)
- `hardenpostgismetadatadmlboundary`: `20260930174318` (`harden_postgis_metadata_dml_boundary`), `20260930195034` (`20260930210400_harden_postgis_metadata_dml_boundary`)
- `enforceproductionmeterphysicalidentity`: `20260930174644` (`enforce_production_meter_physical_identity`), `20260930195037` (`20260930210500_enforce_production_meter_physical_identity`)

## Release decision

Migration-history reconciliation remains **BLOCKED / unresolved** until each repository file and each live record is reviewed against actual SQL definitions, deployment records, and schema state, with one explicit status per item: applied-equivalent, applied-renamed, pending-approved, or unresolved. A clean-chain test and reviewed backup/restore/rollback plan are required before any production migration. Do not use `supabase db push`, replay historical files, or edit migration history as a shortcut.

No production schema or data changes were made by this inventory.
