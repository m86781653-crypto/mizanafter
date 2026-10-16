# MIZAN AI — Baseline Audit & Closure Report
**Report date:** 2026-10-16  
**Status:** OPEN — Production readiness NOT APPROVED  
**Repository:** `m86781653-crypto/mizanafter`  
**Branch reviewed:** `main`  
**Reference HEAD recorded during the audit:** `dc84abdcfd35e72696e9d05a6ce76525e2c7f102`  
**Supabase project reference:** `dofteozulbjwnzofcfmo`

> **Evidence limitation:** This report consolidates the available read-only audit evidence recorded on 16 October 2026. It is not a claim that every check was rerun at the time this file was committed. Findings must be revalidated against the current repository, live database, and actual customer-facing deployment before closure.

## 1. Executive decision

MIZAN AI is **not approved for full production handover** on the evidence available. CI passing is useful but does not establish production security, correct tenant isolation, migration parity, safe financial workflows, offline reliability, or that the deployed customer-facing domain runs the reviewed repository revision.

The immediate priorities are:
1. Resolve and regression-test archived tenant/project access.
2. Restrict and validate PostGIS-related grants and callable functions.
3. establish the identity of the actual production Vercel project/domain and its deployed commit.
4. Resolve the production migration-ledger divergence through a controlled, schema-first reconciliation process.
5. Prevent destructive loss of customer-linked financial history and assess test/E2E data in production.
6. Verify the intended meter-reading review permissions against the approved product reference.

No application, production database, grant, migration-history, or deployment changes were made as part of the recorded audit. SQL inspection and permission probes were read-only/non-destructive.

## 2. Scope and evidence standard

The review covered the evidence available for:
- Git repository and CI workflow configuration.
- Product/reference governance and reference-parity status.
- A read-only production data snapshot.
- Selected authorization, database grants, migration history, financial deletion, OCR persistence, offline behavior, and role-provisioning paths.
- Available Vercel project/deployment metadata.

Finding labels:
- **Observed:** directly present in the inspected code/configuration/data snapshot.
- **Reproduced:** a non-destructive check demonstrated the behavior.
- **Risk / requires validation:** a credible failure mode identified in code, not established as an actual incident.
- **Unknown:** insufficient evidence to assert either success or failure.

This report does not certify complete application security, regulatory compliance, 99% operational reliability, or successful field-pilot performance.

## 3. Source-of-truth and reference governance

### 3.1 Product reference parity remains open

The repository contains:
- `docs/mizanbaseline/MIZAN_REFERENCE_PARITY_AUDIT_v1.0.md`
- `MIZAN_REFERENCE_AUTHORITY_INDEX_v1.0.md`
- `MIZAN_PRODUCT_REFERENCE_CROSSWALK_v1.0.md`
- `decisions/2026-10-15-four-operational-roles.md`
- `official-reference-extracts/MIZAN_Decision_Log_Addendum_2026-10-15.md`

The recorded parity audit status is **OPEN**. The Word reference and Markdown representation do not yet have evidence of a formally completed line-by-line parity closure. The crosswalk is a navigation aid, not proof of parity. Until the owner formally closes this discrepancy, use the approved Word reference as the behavioral authority; do not silently substitute the Markdown version or infer requirements.

### 3.2 Four operational roles

The recorded 15 October decision identifies:
- `project_manager`
- `meter_reader`
- `collection_officer`
- `operations_maintenance`

A decision record alone does not prove that role provisioning, UI behavior, RLS/RPC authorization, and production user slots are implemented consistently. Validate all four end-to-end against the approved reference.

### 3.3 Evidence integrity

The previously circulated “50 subscribers field trial” memo is void and must **not** be cited as evidence. Available field testing has been very limited (reported as approximately one or two meters); do not describe MIZAN as having completed a full pilot. The Rural Water Authority Taiz letter supports permission/facilitation or possible adoption subject to success; it is not proof of a completed deployment or successful field trial.

## 4. Repository and CI findings

### 4.1 Recorded repository state

- Recorded HEAD: `dc84abdcfd35e72696e9d05a6ce76525e2c7f102`.
- Comparison with `6899f234fcc4206b7a87823cbf6c350d96765add` showed predominantly reference/documentation changes, not corresponding application or migration fixes.
- Commit reference: https://github.com/m86781653-crypto/mizanafter/commit/dc84abdcfd35e72696e9d05a6ce76525e2c7f102

Recheck HEAD before relying on this baseline; subsequent commits may have changed the state.

### 4.2 CI coverage gaps

Recorded observations:
- Main CI and the database-contract workflow passed for the tested scope.
- The repository contained 35 SQL test files, while the workflow ran 34.
- Missing from the workflow: `supabase/tests/029_governed_tariff_creation_contract.test.sql`.
- `package.json` did not define an `npm test` script.
- CI used `npm install --no-audit --no-fund`; use `npm ci` when a committed lockfile and the workflow design support deterministic installation.

**Interpretation:** passing CI proves only the checks actually run. It does not establish end-to-end UI/auth behavior, live schema parity, or the correctness of untested production workflows.

## 5. Production data snapshot

The following counts are from the recorded read-only snapshot and must be refreshed before cleanup or handover.

| Area | Recorded observation |
|---|---:|
| Tenants | 6 total: 1 active main tenant, 1 active sub-tenant, 4 archived sub-tenants |
| Projects | 5 total; 2 marked active, including one under an archived tenant |
| Profiles | 5 |
| Customers | 17 |
| Meters | 17 |
| Meter readings | 10 |
| Invoices | 10 |
| Payments | 1 |
| Wells / pumps / tanks | 1 / 1 / 1 |
| Production meters | 0 |
| Water production readings | 0 |
| Pump operation cycles | 0 |
| Faults / work orders | 2 / 2 |
| Audit logs | 137 |
| AI logs | 0 |

The Al-Misrakh water project contains subscriber/meter and billing-related records but no recorded water-production readings. The “Northern Rural Water” project was practically empty and its tenant was archived.

The snapshot also identified 10 customers with test/E2E-style names, 10 test-numbered meters, 10 invoices linked to those test customers, one payment linked to a test customer, and 10 meter readings referencing `e2e.invalid` image URLs. The `meter-readings` storage bucket was private and contained two objects at the time of inspection.

**Required handling:** classify these records with the data owner, assess audit and financial implications, take an approved backup, and prepare a reversible archive/cleanup plan. Do not delete or rewrite records directly during an audit.

## 6. Findings and risk register

### P0 — Immediate security or production-identity blockers

#### P0-01 — Archived tenant/project access
**Evidence:** The inspected `private.mizan_can_access_project` logic did not consistently require both tenant and project to be active. A non-destructive probe for a viewer associated with an archived tenant observed `tenant_status = archived`, `archived_project_access = true`, and one operational report row.

**Risk:** archived entities may remain reachable through a reporting path. Treat this as a tenant-isolation/access-control defect until corrected and regression-tested.

**Closure criteria:**
- Enforce active tenant and active project requirements in every relevant authorization branch.
- Add negative tests for archived tenant, archived project, cross-tenant access, direct RPC access, and report access.
- Verify authorized active-tenant paths still work.
- Review related functions and policies for equivalent bypasses.
- Obtain independent verification before production deployment.

#### P0-02 — PostGIS privileges and SECURITY DEFINER functions
**Evidence:** `public.spatial_ref_sys` had RLS disabled and showed SELECT/INSERT/UPDATE/DELETE privileges for `anon` and `authenticated`. Three `public.st_estimatedextent(...)` overloads were SECURITY DEFINER and executable by `anon`.

**Risk:** an unnecessarily broad database permission surface. The evidence does not by itself prove data exfiltration or exploitation.

**Closure criteria:**
- Review required access for each role and revoke unjustified table/function privileges, including relevant PUBLIC/default privileges.
- Review function ownership, search paths, and SECURITY DEFINER behavior.
- Add privilege-contract tests for anonymous and authenticated roles.
- Rerun Supabase Advisor and verify expected application behavior after the approved change.

#### P0-03 — Actual production deployment identity is unverified
**Evidence:** the accessible Vercel project was `mizan-water-insight`, linked to `Mofeed25/mizan-water-insight`, with a recorded production deployment dated 20 September 2026 at commit `9c4ab93ddbc04296602819bbc5598ef04ed44e66`. The expected `mizanafterv1` project or a project linked to `m86781653-crypto/mizanafter` could not be verified within the available access scope; attempts to inspect relevant deployment/team scope returned 404/403.

**Risk:** there is no evidence that the customer-facing production domain is running the reviewed source of truth.

**Closure criteria:**
- The owner identifies the actual production project and customer-facing domain.
- Verify repository linkage, production branch, build settings, environment-variable names (never expose secret values), and deployed commit SHA.
- Confirm the deployed revision corresponds to the approved repository state.
- Do not relink projects or deploy until identity and rollback procedures are confirmed.

### P1 — High-priority correctness, integrity, and operational risks

#### P1-01 — Meter-reading review authorization may not match the intended role
**Evidence:** `mrx_review_meter_reading` calls `private.mizan_can_write_project(project_id, 'meter_readings', 'update')`. The inspected permission mapping appeared to allow `meter_readings` only for `insert` with `meter.capture`. A non-destructive probe returned meter-reader insert=true and update=false.

**Risk:** the intended review workflow may fail for the intended actor. Do not solve this by granting broad UPDATE access without checking the approved product reference.

**Closure criteria:** identify the intended reviewer and permission from the authoritative reference; implement least-privilege authorization; test allowed and denied cases for all four operational roles.

#### P1-02 — Test/E2E-like records in production
See Section 5. These records may contaminate reporting and have financial/audit implications. Confirm ownership and purpose, backup first, then approve a reversible cleanup/archive plan. Do not delete directly.

#### P1-03 — Migration-ledger divergence
**Evidence:** 129 migration files in the repository versus 163 entries in production `supabase_migrations.schema_migrations`; only 16 migration version identifiers matched exactly in the recorded comparison.

**Interpretation:** the migration ledger diverges. This does **not**, by itself, prove every database object differs from the repository.

**Closure criteria:**
1. Obtain a schema-only production dump and securely preserve it.
2. Rebuild the repository schema from a clean local database using the documented migration process.
3. Compare tables, columns, types, constraints, indexes, functions, triggers, RLS policies, grants, extensions, and relevant configuration.
4. Explain every divergence and agree on a recovery/reconciliation plan.
5. Validate on a restored staging copy before any production operation.

**Prohibited before approval:** do not run `db push`, replay migrations against production, or manually rewrite the production migration ledger.

#### P1-04 — Customer deletion may cascade into invoice history
**Evidence:** `src/pages/CustomersPage.tsx` deletes a customer directly, and `invoices_customer_id_fkey` uses `ON DELETE CASCADE`.

**Risk:** deleting a customer may remove linked financial invoice history.

**Closure criteria:** prefer customer deactivation/archival; define retention and audit requirements; add tests proving historical invoices/payments remain intact. Any cleanup must be reviewed and reversible.

#### P1-05 — OCR metadata is validated but not persisted
**Evidence:** `WaterProductionPage.tsx` submits `p_detected_serial_number`, `p_ai_confidence`, and `p_ai_model`; the RPC validates these inputs, but the inspected INSERT into `water_production_readings` does not store them, and the table lacks corresponding columns.

**Risk:** the platform may lose OCR provenance needed to explain or audit a reading.

**Closure criteria:** design and approve persistence for the detected serial number, confidence, model/version, capture time, actor, raw/manual value as applicable, and evidence reference. Add schema and RPC contract tests before deployment.

#### P1-06 — Potential arrears double-counting; not proven as an incident
**Evidence:** `private.mizan_issue_invoice_for_reading` sums prior unpaid balances into `v_arrears` and includes arrears in the new invoice `grand_total`/balance.

**Risk:** old unpaid balances could be counted again if prior invoice balances remain outstanding. No new invoice was generated during this audit, so actual double-counting is **not established**.

**Closure criteria:** in an isolated test environment, test consecutive unpaid periods, partial payments, full payments, and invoice adjustments; document the intended accounting model and prove balances reconcile without duplicate debt.

#### P1-07 — Offline behavior not proven end-to-end
**Evidence:** static inspection of `public/mizan-offline.js` showed app-shell caching for `/` and `/index.html` plus OCR assets. The local-asset fetch path did not clearly cache first-fetched assets; installation may fail if an external OCR asset cannot be downloaded.

**Risk:** offline installation, capture, or synchronization may be incomplete.

**Closure criteria:** test on a real target device/browser with network loss and recovery, including login/session constraints, reading capture, photos, multiple queued records, retries, duplicate prevention, conflict handling, and visible sync status. Do not claim reliable offline operation until this passes without data loss or duplication.

#### P1-08 — SQL contract test omitted from CI
The workflow did not run `supabase/tests/029_governed_tariff_creation_contract.test.sql` although the file existed. Add it to the appropriate test workflow and confirm it executes in CI. Decide explicitly whether a separate `npm test` script is required; do not rely on an absent script.

#### P1-09 — Fourth operational role provisioning is incomplete/unproven
**Evidence:** the role catalog included `operations_maintenance`, but no production profile with that role was observed, and `private.subtenant_user_slots` had no slot for it in the recorded snapshot.

**Closure criteria:** reconcile the four-role decision with tenant slot limits, provisioning flows, UI role assignment, database authorization, and audit logging. Do not create a production user or expand privileges as part of this audit.

### P2 — Hardening and follow-up

- Supabase Advisor reported 28 foreign keys without supporting indexes. Review existing indexes and query plans before adding any index; prioritize by actual workload and constraints.
- Some tables in the `private` schema lacked RLS, but no direct grants to `anon`/`authenticated` were found on the tables checked. Do not infer public exposure from an RLS warning alone; verify schema usage, grants, ownership, and callable paths.
- Leaked-password protection was reported as disabled. Review the available Supabase Auth setting and enable it if supported and appropriate for the project.
- Advisor showed 29 SECURITY DEFINER functions executable by `authenticated`. The count alone is not a vulnerability. Review each function's purpose, grants, search path, input validation, tenant authorization, and data exposure.

## 7. Closure plan and verification gates

### Gate A — Confirm the baseline
- Refresh repository HEAD, workflow results, production schema snapshot, and deployment metadata.
- Confirm the approved Word product reference and close reference parity with an explicit crosswalk and owner sign-off.
- Record evidence links, timestamps, commands/queries, and outcomes for every check.

### Gate B — Close P0 security and identity blockers
- Fix archived tenant/project authorization in a branch.
- Tighten unjustified PostGIS table/function grants.
- Identify the real production Vercel project/domain and deployed SHA.
- Add regression tests and independent review.
- No production release until the fixes pass and rollback is prepared.

### Gate C — Protect data and accounting
- Produce an approved classification of test/E2E-like production data.
- Protect invoice/payment/audit history and replace destructive customer deletion with archival/deactivation.
- Verify arrears and invoice balance behavior in isolated tests.

### Gate D — Reconcile database safely
- Compare clean migration rebuild with a schema-only production dump.
- Produce an object-by-object discrepancy report.
- Validate the recovery plan on staging; obtain explicit approval before any production reconciliation.

### Gate E — Complete role and field workflows
- Test all four roles against approved permissions, tenant isolation, and separation of duties.
- Verify OCR provenance persistence.
- Execute realistic offline/online synchronization tests on target devices.

### Gate F — Release readiness
- Run full CI including all SQL contract tests, build/type/lint checks, security checks, and agreed end-to-end scenarios.
- Verify production deployment SHA and smoke tests against the intended domain.
- Confirm backup/restore and rollback procedures.
- Obtain owner acceptance of residual risks and a written release decision.

For every gate, record **PASS / FAIL / BLOCKED**, the evidence, reviewer, and date. A finding is not closed merely because code was changed; closure requires passing tests and evidence from the relevant environment.

## 8. Production change-control restrictions

Until the applicable gate is approved:
- Do not modify production data, RLS policies, grants, schema, migration history, or deployment linkage.
- Do not run destructive cleanup, customer deletion, migration replay, or production `db push`.
- Do not widen a role's permissions merely to make a workflow pass.
- Do not treat CI success, a letter of facilitation, or very limited meter testing as proof of complete production readiness.
- Preserve backups, audit logs, and financial history.

## 9. Final readiness statement

**Current decision: NOT APPROVED for full production handover.**

The available evidence indicates actionable access-control, permission-surface, deployment-identity, migration-governance, and data-integrity risks, plus unresolved verification gaps. This decision is intentionally evidence-based: it does not mean every suspected issue is a confirmed incident. Approval requires closure evidence for P0 findings and completion of the applicable P1 release gates.

**Report owner:** MIZAN AI project owner  
**Audit mode:** Read-only/non-destructive review  
**Change status:** No application, production database, grant, migration-ledger, or deployment changes performed by this audit.


## 10. Follow-up repository verification (after initial report creation)

This section records a subsequent read-only check of repository state. It does not imply that production systems were changed or that the original audit was fully rerun.

### 10.1 Workflow omission confirmed on current `main`

The current `.github/workflows/database-contract.yml` contains an explicit step for `supabase/tests/029_water_production_measurement_contract.test.sql`, but no step for the separate existing file `supabase/tests/029_governed_tariff_creation_contract.test.sql`. The governed tariff test file exists in the repository. This confirms that the latter contract is not explicitly invoked by this workflow.

**Next action:** add a dedicated workflow step in a reviewed change and verify the test passes in a clean local Supabase run. Do not treat the presence of the test file as evidence that CI executes it.

### 10.2 Customer deletion path confirmed

The current `src/pages/CustomersPage.tsx` contains a `handleDelete` path that calls `supabase.from('customers').delete().eq('id', id)`. Combined with the previously observed `ON DELETE CASCADE` relationship from invoices to customers, this remains a high-priority data-retention risk until the foreign-key behavior and intended archival workflow are independently rechecked against the current production schema and the UI path is replaced or constrained.

**Next action:** define a reversible deactivation/archive workflow and test that invoice/payment history remains preserved. No deletion or code change was made during this verification.

### 10.3 Offline cache path remains unverified in a real browser

The current `public/mizan-offline.js` caches the app shell and OCR assets during service-worker installation. A same-origin GET cache miss falls through to `fetch(event.request)` without an apparent cache write for that response; navigation responses are handled separately and written to `/index.html`. Static reading alone cannot establish whether the complete user workflow works offline.

**Next action:** perform controlled device/browser tests covering initial installation, loss of connectivity, reading/photo capture, queued submissions, reconnection, retries, and duplicate prevention. No claim of successful end-to-end offline behavior is made.

### 10.4 Development-branch divergence is a release-control blocker

The repository's `docs/MIZAN-PRODUCTION-DELIVERY-CONTRACT.md` identifies `feature/production-operational-governance-final` as the current implementation branch and states that its review PR is separate from `main`. A GitHub compare check between `main` and that branch reported the feature branch as **96 commits behind main and 0 commits ahead** at the time of that check. This is an unusual state that must be reconciled before any merge or deployment decision; do not infer which branch contains the intended releasable implementation from the branch name alone.

**Next action:** identify the intended PR and its head/base SHAs, inspect the complete diff and checks, confirm which branch contains the approved application changes, and determine whether the contract document is stale. Do not merge, rebase, force-push, or deploy based on this audit finding alone.

### 10.5 Scope boundary

These follow-up checks were read-only. They did not change application code, production database state, grants, migration history, or deployment configuration. Findings remain open until the relevant change is reviewed and verified in the appropriate environment.


### 10.6. Pull-request history resolves part of the branch ambiguity

Follow-up metadata inspection found:
- PR #64, `feat: finalize production operational governance and period reporting`, is **merged** into `main` (2026-09-30 16:04 UTC).
- PR #65, `feat: close production operational governance gaps`, is **merged** into `main` (2026-09-30 19:43 UTC).
- PR #65's description says merge was intentionally deferred until migration parity, security, E2E, and production verification were clean, but GitHub metadata confirms the PR was subsequently merged.

This means the delivery-contract sentence saying the review PR is still separate from `main` is stale or was not updated after the merge. The feature branch being 96 commits behind is therefore not, by itself, evidence that the PR changes are absent from `main`; those PRs are merged. The remaining release-control question is whether the merged changes satisfy their stated deferred verification conditions and whether the customer-facing production deployment points to the approved `main` SHA.

**Next action:** update the delivery contract's branch/status section only after confirming the intended active development branch and current release target. Review merged PR checks and production evidence; do not reopen or merge the stale branch just to make its tip match `main`.


### 10.7. Deployment status checks are not the same as production-domain verification

GitHub commit status metadata showed:
- On PR #65's merge commit `6d94de235b905a132c9d629d0b5aaa8651580360`, the `Vercel – mizanafterv1` status was **success**.
- The `Vercel – mizanafter` and `Vercel – mizanafter-gojh` statuses were **failure**; PR discussion records Vercel's `api-deployments-free-per-day` rate-limit error for deployment attempts.
- The later audit-document commit also showed a successful `Vercel – mizanafterv1` status, while the two other project statuses failed.

The connected Vercel tools did not expose the relevant projects/team or resolve the deployment by the status target identifier, so the live production domain, deployment target, and deployed application SHA remain **unverified**. A successful commit status alone is not proof that the domain used by water-project users serves that build.

**Next action:** an authorized owner must verify the production project, domain assignments, Git repository linkage, production branch, and exact deployment commit in Vercel. Confirm whether the rate-limited legacy projects are obsolete or still route live traffic before changing or deleting any project.


### 10.8. Repository mitigations found; production application remains unproven

A targeted inspection of current `main` found repository migrations for two previously recorded findings:
- `20260930210400_harden_postgis_metadata_dml_boundary.sql` revokes client-role privileges on PostGIS metadata tables and `st_estimatedextent` overloads.
- `20260930210600_align_four_operational_role_slots.sql` allows the canonical four operational role values in `private.subtenant_user_slots`.

These are **repository-level mitigations only**. Because the production migration ledger diverges from the repository, the audit cannot assert that either migration has been applied to production. Verify live privileges and role-slot constraints after schema/migration reconciliation; do not replay either migration blindly.

A separate review of `20260930210000_harden_production_measurement_capture_authority.sql` found that the capture RPC accepts and validates detected serial number, OCR confidence, and AI model metadata, but its INSERT into `public.water_production_readings` does not include those fields. The OCR provenance persistence finding therefore remains open in the current repository code, not merely unverified in production.

The existing production-readiness decision remains **NOT APPROVED** until the code-level issue is corrected and tested, and the production-only findings are independently verified against live state.
