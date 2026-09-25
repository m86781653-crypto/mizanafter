# MIZAN AI — Reference Integration Baseline

## Reference source

- Repository: `n36192655-cloud/mirror-sync-complete`
- Reference branch: `main`
- Reference commit: `cd361d9a9a5f52b113385ae3b800d982df323a38`
- Target repository: `m86781653-crypto/mizanafter`
- Target workstream: `integration/reference-mirror-sync-complete-v2`

## Non-destructive rule

The reference repository is read-only for this integration. No commit, branch, issue, PR, setting, or file is to be modified in `n36192655-cloud/mirror-sync-complete`.

The target remains the authoritative MIZAN AI codebase. Existing security hardening, MRX, billing, tenant/project isolation, production checks, and Supabase work are preserved.

## What is already integrated from the reference

The target already contains exact or adapted reference implementations for:

- geolocation capture
- meter image quality checks
- meter OCR and reading profiles/lifecycle/deadline/attempt logic
- field camera capture
- offline field synchronization
- MRX server-authoritative capture
- project-scoped reading workflow
- production-oriented billing/collection controls

Several core meter-reading helper/test files are byte-identical to the reference baseline; other files are intentionally adapted to the target architecture and security model.

## What must NOT be copied wholesale

Do not copy the reference repository's Supabase migration history or replace the target database schema with it. The two systems have different migration histories and the target has production-specific security/RLS/MRX/billing controls.

Do not copy the reference authentication implementation wholesale.

Do not copy the reference TanStack Start routing/server architecture wholesale into the target Vite application.

Do not introduce an ERP architecture.

## Remaining reference capabilities to reconcile

The reference still contains additional application capabilities that must be evaluated and, where appropriate, ported into the target architecture rather than blindly copied:

1. MIZAN AI assistant/Copilot and Arabic assistant tooling.
2. Advanced meter-vision server pipeline and its proof/verification boundary.
3. Offline OCR runtime assets and restart/network-disabled verification.
4. Additional field/offline cache and synchronization behavior.
5. Meter-management/attempt/deadline operational UX where the target lacks equivalent behavior.
6. Relevant reporting, loss-analysis, tariff, and operational assistant capabilities that are useful to MIZAN AI.
7. Reference tests that cover behavior not yet represented in the target test suite.

Every imported capability must be reconciled with the target's current RBAC, RLS, MRX authority, billing authority, storage security, and migration strategy.

## Release rule

No reference feature is considered activated merely because its source file was copied. It is activated only after:

- target-compatible implementation exists;
- typecheck/lint/build pass;
- database contract tests pass where applicable;
- security review passes;
- tenant/project isolation is verified;
- offline behavior is verified where applicable;
- production Supabase state is reconciled before any production migration is applied.

## Current source-of-truth hierarchy

1. Target repository `m86781653-crypto/mizanafter` for application code.
2. Production Supabase for actual production database state.
3. Reference repository `n36192655-cloud/mirror-sync-complete` as a read-only feature/reference baseline.
