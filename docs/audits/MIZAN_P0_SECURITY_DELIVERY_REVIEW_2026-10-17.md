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
- **Production application status:** the migration is in the repository. This review did not apply it to the live database; confirm its production migration state before claiming the fix is live.

## 3. PR #81 — customer/invoice history protection

- Status: merged.
- PR head tested: `a84116a0c2bed38c787421381cced90e031c2db9`; merge commit: `0590ce51155f3058cbc5c7116ba4608728dddb79`.
- Changes: remove destructive customer deletion from the UI, remove client DELETE policy on customers, change `invoices_customer_id_fkey` from `ON DELETE CASCADE` to `ON DELETE RESTRICT`, add a database-contract test.
- Verification on the exact PR head: MIZAN CI passed; clean-chain database-contract passed, including the customer-history and project-lifecycle contracts.
- The migration is now in repository `main`; this review did not apply it to the live database. Confirm production migration state before claiming the database-side fix is live.
- No live production schema or data changes were made by this review.

## 4. P0 blocker — PostGIS function ACL

**Evidence from read-only production SQL inspection:**
- `public.st_estimatedextent(text,text)`
- `public.st_estimatedextent(text,text,text)`
- `public.st_estimatedextent(text,text,text,boolean)`

All three functions are owned by `supabase_admin`, implemented in C, marked `SECURITY DEFINER`, and their ACL grants EXECUTE to `PUBLIC`, `anon`, and `authenticated`. Effective privilege checks returned true for all three client/public roles.

The connected `postgres` role is not a superuser and is not a member of `supabase_admin`. The attempted REVOKE in PR #79 did not remove the grants; CI failed in `033_extension_schema_security_contract.test.sql` on these negative assertions. Repeating the same REVOKE is not a fix.

- Tracking issue: [#84](https://github.com/m86781653-crypto/mizanafter/issues/84).
- PR #79 remains draft and must not be merged as a fix.
- Required exit criterion: a supported owner-level/platform remediation, followed by a passing clean-room negative contract and read-only verification of effective privileges. Do not weaken or delete the security assertions.

## 5. P0 blocker — PostGIS `spatial_ref_sys` table grants

**Evidence from read-only production SQL inspection:**
- `public.spatial_ref_sys` has RLS disabled.
- Its ACL grants `arwdDxtm` to `anon` and `authenticated`; PUBLIC has SELECT.
- Effective privilege checks returned true for both `anon` and `authenticated` on SELECT, INSERT, UPDATE, and DELETE.
- The table is owned by the Supabase-managed role `supabase_admin`.

This is more than the generic RLS advisor warning: the effective ACL includes client write privileges. No write was attempted.

- Tracking issue: [#85](https://github.com/m86781653-crypto/mizanafter/issues/85).
- Required exit criterion: remove client write access through a supported extension-management path, preserve legitimate PostGIS behavior, and prove the resulting effective privileges/API behavior. Do not blindly enable RLS without an appropriate read policy and regression tests.

## 6. Migration-history parity release gate

Read-only comparison observed:
- Repository `main` after PR #81 merge: 131 SQL migration files.
- Live Supabase `schema_migrations`: 163 applied records.
- Latest live record observed: version `20261001152927`, name `20261001150000_fix_profile_update_policy_recursion`.
- A preliminary normalized-name comparison matched 90 repository migration basenames to live migration names. Historical renames, duplicate concepts, and differing recorded versions mean this is a diagnostic comparison only, not a safe replay/apply plan.

Tracking issue: [#87](https://github.com/m86781653-crypto/mizanafter/issues/87).

**Release rule:** map each repository migration to the live history as applied/equivalent/pending/unresolved; validate the clean chain and rollback/recovery before applying any pending migration. Do not blindly run `supabase db push`, replay historic files, delete migration history, or infer equivalence from timestamps.

## 7. Other observed database/advisor findings

- `public.project_seq_counters` and `public.seq_counters` have RLS enabled and no policies. This appears consistent with the stated server-mediated counter boundary; verify all write paths rather than adding broad client policies.
- The `private` schema denies schema USAGE to `anon`; `authenticated` has USAGE but the inspected private tables had no direct anon/authenticated table grants. RLS-disabled private tables are not equivalent to public exposure, but their SECURITY DEFINER call paths still require review.
- Supabase Auth leaked-password protection is disabled (advisor warning).
- Performance advisor reported 28 unindexed foreign keys and 50 unused indexes. Do not automatically add/drop indexes from these counts alone; validate workload, query plans, write overhead, and actual traffic.
- `postgis` is installed in `public`, and the security advisor reports three anonymous-callable SECURITY DEFINER overloads; these align with the ACL blocker above.

## 8. Live data snapshot observed

Table-count snapshot:
- 6 tenants; 5 projects.
- 17 customers and 17 meters.
- 10 meter readings and 10 invoices.
- 1 payment.
- 2 faults and 2 maintenance work orders.
- 0 water-production meters, 0 water-production readings, and 0 pump-operation cycles.
- 137 audit-log rows.

These counts describe the inspected database snapshot only; they do not prove end-to-end workflow completeness or a field pilot.

## 9. Release gates still open

1. Resolve #84 and #85 with supported privilege changes and negative tests.
2. PR #81 is merged after both CI workflows passed on its exact head; verify production migration state before claiming its database-side fix is live.
3. Reconcile migration history using issue #87 before applying any production migrations.
4. Verify production migration state separately from repository state. The live migration list inspected during this review ended at version `20261001152927`; do not assume repository migrations have been applied to production.
5. Confirm deployment status only for the approved Vercel project `mizanafterv1`; do not use unrelated Vercel projects as production evidence.
6. Continue the full reference-to-implementation crosswalk for the remaining P0 workflow requirements: field evidence/identity verification, live state propagation, billing/payment effects, maintenance lifecycle, offline capture/sync/conflicts, period close/roll-forward, traceable reporting, backup/recovery, and role-by-role authorization.

## 10. Explicit status

**Overall MIZAN production readiness: NOT VERIFIED.**  
**P0 security release gate: BLOCKED** by the extension-owned PostGIS ACLs until #84 and #85 are resolved and verified.  
No live production schema or data was changed during this review.