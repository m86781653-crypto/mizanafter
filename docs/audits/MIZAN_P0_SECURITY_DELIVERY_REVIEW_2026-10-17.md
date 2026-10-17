# MIZAN AI — P0 Security and Delivery Review
**Review date:** 2026-10-17  
**Repository:** `m86781653-crypto/mizanafter`  
**Database project:** `dofteozulbjwnzofcfmo`  
**Approved Vercel project:** `mizanafterv1`  
**Scope:** Evidence-based continuation review of current P0 fixes and production release gates. This is not a declaration that the whole platform is production-ready.

## 1. Product-reference basis

The review uses `MIZAN_Master_Product_Reference_v1.0.docx` as the business reference and `MIZAN_Agent_Execution_Contract_v1.0.md` as the agent execution contract.

Relevant reference requirements:
- The operating loop must remain connected: reality/event/evidence/data/verification/result/state/decision/action/impact/history/continuity.
- A technically successful UI/API step is not complete if it produces an incorrect business state, bypasses authorization, loses evidence, changes history incorrectly, or breaks downstream effects.
- Authorization and isolation must be enforced at the data/service layer.
- P0 work must be proven by tests/evidence; unresolved critical isolation or security gaps block a 100% readiness claim.
- The application must preserve field usability and continuity under unreliable connectivity and power conditions.

## 2. Changes integrated into `main`

### PR #83 — governed tariff test coverage
- Status: merged.
- Merge commit: `1f628a1c880d1b6322d8fa32d49f31f99f867228`.
- Purpose: add `supabase/tests/029_governed_tariff_creation_contract.test.sql` to database-contract CI, separated from the unresolved PostGIS remediation.
- Verification before merge: MIZAN CI and database-contract succeeded on the PR head.
- This is test coverage, not a production database migration.

### PR #80 — inactive project/tenant access
- Status: merged.
- Merge commit: `16b003a689a9ae6fe0a1b73b2b0667258abe61f9`.
- Change: `private.mizan_can_access_project(uuid)` now requires active project and tenant states in tenant-scoped paths; the explicit platform-admin governance bypass remains.
- Added SQL contract and behavior tests for own active project, archived project, central/subtenant access, archived tenant, cross-tenant denial, and the explicit platform-admin path.
- Verification before merge: MIZAN CI and database-contract succeeded on the PR head.
- **Live production verification (read-only, 2026-10-17):** the current `private.mizan_can_access_project(uuid)` definition does not require `p.status='active'` in the direct tenant-scoped branch, and does not require the direct tenant status to be active. The subtenant branch does check active project-parent/subtenant conditions. The latest live migration record remains `20261001152927`; the PR #80 migration is not evidenced as applied by migration history. Thus the merged fix is **not verified as live**, and the direct-tenant lifecycle gap remains observable in the live function.

## 3. PR #81 — customer/invoice history protection

- Status: merged.
- PR head tested: `a84116a0c2bed38c787421381cced90e031c2db9`; merge commit: `0590ce51155f3058cbc5c7116ba4608728dddb79`.
- Changes: remove destructive customer deletion from the UI, remove client DELETE policy on customers, change `invoices_customer_id_fkey` from `ON DELETE CASCADE` to `ON DELETE RESTRICT`, add a database-contract test.
- Verification on the exact PR head: MIZAN CI passed; clean-chain database-contract passed, including the customer-history and project-lifecycle contracts.
- **Live production verification (read-only, 2026-10-17):** `public.invoices_customer_id_fkey` still uses `ON DELETE CASCADE`; the permissive `mizan_tenant_delete` policy applies to the `authenticated` role on `public.customers`. Therefore the PR #81 database protection is **not live** in the inspected production schema. The merged migration is not evidenced as applied by migration history. This is a confirmed financial-history integrity risk, not just an unverified rollout assumption.
- No live production schema or data changes were made by this review.

## 4. P0 blocker — PostGIS function ACL

**Evidence from read-only production SQL inspection:**
- `public.st_estimatedextent(text,text)`
- `public.st_estimatedextent(text,text,text)`
- `public.st_estimatedextent(text,text,text,boolean)`

All three functions are owned by `supabase_admin`, implemented in C, marked `SECURITY DEFINER`, and their ACL grants EXECUTE to `PUBLIC`, `anon`, and `authenticated`. Effective privilege checks returned true for all three client/public roles.

The connected `postgres` role is not a superuser and is not a member of `supabase_admin`. The attempted REVOKE in PR #79 did not remove the grants; repeating the same REVOKE is not a fix.

The existing `033_extension_schema_security_contract.test.sql` explicitly asserts that PostGIS remains installed in `public` and that relocation is separately governed. A move to `extensions` therefore cannot be made silently as part of this PR; it requires a governed change to that contract and validation of all nine application `geography` columns and dependent spatial operations. Supabase documents a supported managed relocation path via Support when avoiding a drop/recreate; see https://supabase.com/docs/guides/database/extensions/postgis.

Latest isolated PR #79 head: `f55803a9a9d6767e73da8139a0874e5068110844`. MIZAN CI passed; `database-contract` failed at `033_extension_schema_security_contract.test.sql`: 6 of 25 assertions failed (tests 4–9), all six negative EXECUTE checks for the three overloads. The diagnostic ACLs still show EXECUTE granted to PUBLIC, anon, and authenticated.

- Tracking issue: [#84](https://github.com/m86781653-crypto/mizanafter/issues/84).
- PR #79 remains draft and must not be merged as a fix.
- Required exit criterion: a supported owner-level/platform remediation, followed by a passing clean-room negative contract and read-only verification of effective privileges. Do not weaken or delete the security assertions.

## 5. P1 integrity/availability risk — PostGIS `spatial_ref_sys` exposure

**Evidence from read-only production SQL inspection:**
- `public.spatial_ref_sys` has RLS disabled.
- Its ACL grants `arwdDxtm` to `anon` and `authenticated`; PUBLIC has SELECT.
- Effective privilege checks returned true for both `anon` and `authenticated` on SELECT, INSERT, UPDATE, and DELETE.
- The table is owned by the Supabase-managed role `supabase_admin`.

Supabase's current PostGIS documentation says this is an expected Security Advisor finding and **not a data-confidentiality exposure**, because `spatial_ref_sys` contains built-in coordinate-system definitions, not application data. The confirmed write grants remain an integrity/availability risk if definitions are modified, and PostGIS is installed in the API-exposed `public` schema.

- Tracking issue: [#85](https://github.com/m86781653-crypto/mizanafter/issues/85).
- Reference: https://supabase.com/docs/guides/database/extensions/postgis
- The live schema has nine application `geography` columns. Do not drop/recreate PostGIS with `CASCADE` without a reviewed backup/restore plan; use a supported managed move or contact Supabase Support.
- Required exit criterion: document the supported schema-relocation decision, preserve legitimate PostGIS behavior, and verify effective API exposure/spatial operations after the change. Do not blindly enable RLS or repeat `REVOKE` as `postgres`.

## 6. Migration-history parity release gate

Read-only comparison observed:
- Repository `main` after PR #81 merge: 131 SQL migration files.
- Live Supabase `schema_migrations`: 163 applied records.
- Latest live record observed: version `20261001152927`, name `20261001150000_fix_profile_update_policy_recursion`.
- A fresh read-only normalized-name inventory matched 102 live records to 91 unique repository migration filenames; 40 repository files had no normalized live-name match, and 61 live records had no normalized repository-name match. Eleven normalized live-name groups contain duplicate records. These are filename/name comparisons only, not SQL equivalence or applied-state proof.
- Full reproducible inventory: `docs/audits/MIZAN_MIGRATION_HISTORY_NAME_RECONCILIATION_2026-10-17.md`.

Tracking issue: [#87](https://github.com/m86781653-crypto/mizanafter/issues/87).

**Release rule:** map each repository migration to the live history as applied/equivalent/pending/unresolved; validate the clean chain and rollback/recovery before applying any pending migration. Do not blindly run `supabase db push`, replay historic files, delete migration history, or infer equivalence from timestamps.

## 7. Operating-cycle and offline verification gaps

### Operating-period close and roll-forward — not evidenced
The master product reference requires live updates during the period, immutable closed-period results, and explicit roll-forward of continuing states/balances. The live catalog query found reporting/billing period fields and equipment operation cycles, but no dedicated operational-period close/roll-forward routine or table. The repository tree has no dedicated period-close/roll-forward contract test. Reporting date filters alone do not prove this behavior.

Tracking issue: [#88](https://github.com/m86781653-crypto/mizanafter/issues/88).

### MRX offline capture/synchronization — implementation exists; end-to-end proof is missing
The code contains `mrxOfflineQueue.ts` and `mirrorSync.ts` with retry/conflict-related logic. The recursive repository tree contains no dedicated test file for these queue/sync modules. Existing OCR and reading-lifecycle tests do not prove durable offline capture, photo persistence, idempotent retry, conflict recovery, and reconnection behavior end-to-end.

Tracking issue: [#89](https://github.com/m86781653-crypto/mizanafter/issues/89).

These are evidence gaps; do not infer a specific replacement architecture. Discover the existing path and test it against the reference. The live snapshot also has 0 water-production meters, 0 water-production readings, and 0 pump-operation cycles, so live end-to-end water-production behavior is not demonstrated by the current data snapshot.

## 8. Reference-to-implementation operating-cycle crosswalk

| Reference stage | Current implementation evidence | Status | Remaining proof/gap |
|---|---|---|---|
| Project/tenant context and authorization | Tenant/project data exists; PR #80 and tests 045/046 cover active/archived project access. | **PARTIAL / BLOCKED** | The PostGIS function ACL blocker (#84) prevents a production-security-ready conclusion; #85 is a separately classified P1 integrity/availability and schema-hygiene risk. Production migration state is not yet reconciled. |
| Field reading and evidence capture | `ReadingsPage`, MRX queue/OCR code, tests 025–028. Live snapshot: 10 readings, all with image URL, AI model, client capture ID, and non-null quality-review status. | **PARTIAL** | All 10 readings lack GPS coordinates in this snapshot; absence alone is not a failure unless required by the capture context. Offline queue/sync has no dedicated tests (#89). No field trial is inferred from these rows. |
| Reading-to-invoice traceability | Live snapshot has 10 invoices; all 10 have source reading links, tariff references, and calculation snapshots. Read-only consistency query found no missing source reading or project/customer/meter/current/previous-reading mismatch. Tests 016, 017, 021 and 029 cover tariff/billing contracts. | **PARTIAL** | Cross-table consistency is verified for these rows; independent recomputation of every amount and end-to-end behavior across all roles/edge cases is not established by these checks alone. |
| Payment and balance propagation | Live snapshot has 1 approved payment linked to an invoice; project/customer links match, amount value is 20, invoice amount-paid total is 20; the inspected `payments` schema has no currency column, so the currency unit cannot be proven, and no approved-payment/amount-paid mismatch was found. Tests 018 and 044 cover approval/locking contracts. | **PARTIAL** | One live record does not establish full payment, arrears, rejection, duplicate retry, reversal, or period-transition behavior. |
| Water production and pump operation | `WaterProductionPage`, `water_production_meters`, `water_production_readings`, `pump_operation_cycles`; tests 029 and 036. | **CANNOT BE VERIFIED LIVE** | Live snapshot has 0 production meters, 0 production readings, and 0 pump-operation cycles. Contract tests are not proof of live operational use. |
| Faults and maintenance | Fault/maintenance pages and tests 031/032. Live snapshot has 2 faults, 2 work orders, and 0 closed work orders. | **PARTIAL** | The snapshot contains no closed work order to verify the full close/result/history path in live data. |
| Reporting and analysis | `ReportsPage`, governed operational report RPC, tests 034/041. Live snapshot has 0 KPI snapshots, 1 water-balance row, and 0 AI-log rows. | **PARTIAL** | Contract presence is verified; historical report immutability, traceable calculation provenance, and actual live AI audit trail are not proven by the snapshot. |
| Operational-period close and roll-forward | Billing/report pages support date ranges; the catalog query found billing/report period fields but no dedicated operational-period close/roll-forward routine or table. | **NOT EVIDENCED** | Issue #88: prove closed-period immutability and explicit carry-forward of continuing states/balances before claiming the complete cycle. |
| Offline capture, sync and conflict recovery | Existing `mrxOfflineQueue.ts` and `mirrorSync.ts` contain persistence/retry/conflict logic. | **IMPLEMENTED, NOT VERIFIED END-TO-END** | Issue #89: tests are needed for persistence across restart, photo durability, idempotent retries, stale-reading conflict, explicit resolution, and reconnection. |
| Security, data integrity and release history | SQL contract suite, tenant/RLS/function checks, PR #80/#81 changes. | **PARTIAL / BLOCKED** | #84 is the unresolved P0 function-execution boundary; #85 is a P1 extension-schema integrity/availability risk; #87 is unresolved migration-history parity. Do not apply production migrations until the mapping and release gates are complete. |
| Backup, restore, incident recovery and operational monitoring | Not covered by the specific checks in this review. | **CANNOT BE VERIFIED YET** | Require objective evidence for backup completion, restore test, recovery time/data-loss bounds, alerts, and operational ownership before release. |

This crosswalk deliberately separates implemented code, contract tests, live-row consistency, and live operational proof. Passing CI does not upgrade a row to full production readiness when field evidence, closed-period behavior, offline recovery, security, or recovery evidence is missing.

## 9. Other observed database/advisor findings

- `public.project_seq_counters` and `public.seq_counters` have RLS enabled and no policies. This appears consistent with the stated server-mediated counter boundary; verify all write paths rather than adding broad client policies.
- The `private` schema denies schema USAGE to `anon`; `authenticated` has USAGE but the inspected private tables had no direct anon/authenticated table grants. RLS-disabled private tables are not equivalent to public exposure, but their SECURITY DEFINER call paths still require review.
- Supabase Auth leaked-password protection is disabled (advisor warning).
- Performance advisor reported 28 unindexed foreign keys and 50 unused indexes. Do not automatically add/drop indexes from these counts alone; validate workload, query plans, write overhead, and actual traffic.
- `postgis` is installed in `public`, and the security advisor reports three anonymous-callable SECURITY DEFINER overloads; these align with the ACL blocker above.

## 10. Live data snapshot observed

Table-count snapshot:
- 6 tenants; 5 projects.
- 17 customers and 17 meters.
- 10 meter readings and 10 invoices.
- 1 payment.
- 2 faults and 2 maintenance work orders.
- 0 water-production meters, 0 water-production readings, and 0 pump-operation cycles.
- 137 audit-log rows.

These counts describe the inspected database snapshot only; they do not prove end-to-end workflow completeness or a field pilot.

### Read-only cross-table consistency checks

- All 10 invoices have a non-null `source_reading_id`; all 10 source readings exist.
- For all 10 linked invoice/reading pairs, project, customer, meter, current reading, and previous reading match. No missing-source or cross-entity mismatch was found in this snapshot.
- All 10 invoices have a tariff reference and calculation snapshot.
- The single payment is linked to an existing invoice; project/customer links match. It is approved for amount 20, the invoice `amount_paid` total is 20 (the inspected `payments` schema has no currency column, so the currency unit cannot be proven from this snapshot), and the count of invoice/payment approved-total mismatches is 0.
- All 10 readings have an image URL, AI model value, client capture ID, and a non-null quality-review status; none has both GPS coordinates recorded.
- `ai_logs` has 0 rows, `kpi_snapshots` has 0 rows, and `mizan_water_balance` has 1 row.

These checks establish current relational consistency for the observed rows, not correctness of every tariff calculation, proof of a live field trial, full authorization coverage, or a closed-period/roll-forward workflow.

## 11. Release gates still open

1. Resolve #84 with a supported owner-level fix and passing negative tests; follow #85's supported PostGIS schema-remediation path without destructive extension changes.
2. Resolve the migration-history mapping in #87 before any production migration application.
3. Close the operating-period verification gap in #88 and add offline queue recovery tests per #89.
4. PR #81 is merged after both CI workflows passed on its exact head; verify production migration state before claiming its database-side fix is live.
5. Verify production migration state separately from repository state. The live migration list inspected during this review ended at version `20261001152927`; do not assume repository migrations have been applied to production.
6. At main commit `0590ce51155f3058cbc5c7116ba4608728dddb79`, MIZAN CI and database-contract succeeded, and the approved Vercel project `mizanafterv1` check succeeded. This proves the tested code/contracts and deployment check only; it does not prove the pending migrations were applied or the platform is production-ready.
7. Continue the full reference-to-implementation crosswalk for the remaining P0 workflow requirements: field evidence/identity verification, live state propagation, billing/payment effects, maintenance lifecycle, offline capture/sync/conflicts, period close/roll-forward, traceable reporting, backup/recovery, and role-by-role authorization.

## 12. Explicit status

**Overall MIZAN production readiness: NOT VERIFIED.**  
**P0 security release gate: BLOCKED** by #84 until the PostGIS SECURITY DEFINER RPC boundary is corrected and verified. #85 remains a P1 integrity/availability and schema-hygiene issue; it is not a customer-data confidentiality breach.  
No live production schema or data was changed during this review.

## 13. Post-PR #90 revalidation — 2026-10-17

### CI and deployment status

At repository main commit `20680ee0825c1bd018c20d3cc6ae3175fab7c61f`:

- MIZAN CI run [39066464652](https://github.com/m86781653-crypto/mizanafter/actions/runs/39066464652): **success**.
- Database-contract run [39066464743](https://github.com/m86781653-crypto/mizanafter/actions/runs/39066464743): **success**.
- Vercel check for the explicitly approved project `mizanafterv1`: **success**.
- Two other Vercel status contexts (`mizanafter-gojh` and `mizanafter`) reported failure. They are not treated as the approved production project; they are recorded rather than silently ignored.

These results establish the corresponding CI suites and the check for `mizanafterv1`; they do not prove production database migration parity or overall readiness.

### Fresh Supabase advisor snapshot

Security advisor findings observed at 2026-10-17T20:56:49Z:

- Three `public.st_estimatedextent` overloads remain callable by `anon` as SECURITY DEFINER functions.
- `postgis` remains installed in `public`; `public.spatial_ref_sys` remains exposed with RLS disabled.
- Supabase Auth leaked-password protection remains disabled.
- Two sequence-counter tables have RLS enabled without policies; this is an informational finding requiring validation of server-mediated access, not an instruction to add broad client policies.
- The advisor also lists 29 authenticated-callable SECURITY DEFINER functions. Each must be evaluated against its intended caller and internal authorization checks; the count alone does not establish a vulnerability for every function.

Performance advisor snapshot: 28 foreign keys reported without covering indexes and 50 indexes reported unused. These are workload-dependent findings; no index was added or removed based on counts alone.

### Live migration-history status

A fresh migration-history listing returned 163 records; the latest listed version remained `20261001152927` (`20261001150000_fix_profile_update_policy_recursion`). This is not evidence that the merged PR #80/#81 database safeguards are live. The read-only findings documented above remain release blockers until rechecked after a governed deployment.

### Decision

PR #90's targeted offline-photo ordering change is merged and both CI workflows now pass on its merge commit. The offline recovery acceptance criteria in #89 remain open because the current CI addition is a source-contract check, not a runtime IndexedDB/network/restart/conflict test.

Overall readiness remains **NOT VERIFIED**; P0 release remains **BLOCKED** by #84 and #87, with #88 and #89 also open. No live production schema or data was changed during this revalidation.

- **Additional #89 retry edge case:** live `mrx_capture_meter_reading` checks current meter state and write permission before looking up an existing `client_capture_id`. The duplicate lookup exists, but its behavior after a successful server commit followed by a failed local acknowledgement is not proven if meter status/authorization changes before retry. This is recorded for targeted acceptance testing; no claim is made that the scenario has occurred.
