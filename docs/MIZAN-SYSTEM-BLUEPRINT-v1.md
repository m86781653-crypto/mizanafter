# MIZAN AI — System Blueprint & Capability Map v1

**Date:** 2026-09-25  
**Target:** `m86781653-crypto/mizanafter`  
**Workstream:** `integration/reference-mirror-sync-complete-v2`  
**Reference:** `n36192655-cloud/mirror-sync-complete` @ `cd361d9a9a5f52b113385ae3b800d982df323a38`

## 1. Architectural decision

MIZAN AI is not an ERP. It is a **water-service governance, measurement, operations, revenue, and intelligence platform**.

The authoritative loop is:

```
FIELD REALITY
   ↓
EVIDENCE
   ↓
MRX / TRUSTED MEASUREMENT
   ↓
VALIDATION
   ↓
GOVERNANCE
   ↓
DECISION
   ↓
ACTION
   ↓
MEASUREMENT OF RESULT
   └──────────────→ feedback
```

AI is a decision-support layer. It must not become the source of truth.

## 2. Target architecture

```
                           MIZAN AI
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
 Measurement Engine     Governance Engine     Intelligence Engine
        │                     │                     │
        └──────────────┬──────┴──────┬──────────────┘
                       │             │
                Operations Engine  Revenue Engine
                       │             │
                       └──────┬──────┘
                              │
                    Evidence / Audit / MRX
                              │
                  Field + Supabase + Storage
```

### Five core engines

1. **Measurement Engine** — meters, wells, pumps, readings, evidence, OCR, validation, MRX.
2. **Operations Engine** — field work, faults, maintenance, production, work orders, offline/sync.
3. **Revenue Engine** — consumption, tariffs, billing, payments, collections, revenue gaps.
4. **Governance Engine** — roles, scopes, approvals, exceptions, policies, audit, separation of duties.
5. **Intelligence Engine** — anomaly detection, loss intelligence, operational intelligence, analytics, read-only copilot.

## 3. Capability map

| Capability | Reference | Target | MIZAN required state | Action |
|---|---|---|---|---|
| Meter master data | Strong | Present/adapted | Trusted project-scoped registry | Adapt |
| Subscriber/customer | Strong | Present | Project-scoped identity and account | Reuse/adapt |
| Meter capture | Strong | Present | Evidence-first field capture | Reuse/adapt |
| OCR | Strong | Present/adapted | OCR proposal + MRX validation boundary | Adapt |
| Image quality | Strong | Present | Mandatory quality gate | Reuse |
| Meter identity verification | Strong | Present/MRX | Hard trust boundary | Preserve |
| Reading lifecycle | Strong | Present | Approved/pending/rejected with audit | Preserve/adapt |
| Reading attempts/deadlines | Strong | Present | Operational SLA controls | Reuse/adapt |
| Offline field | Strong | Present | Offline-first with safe reconciliation | Adapt |
| Billing | Strong | Present | Approved readings only + policy controls | Preserve/adapt |
| Payments/collection | Strong | Present | Approved financial events + audit | Preserve/adapt |
| Water-loss analysis | Present | Present | Evidence-based loss intelligence | Redesign |
| Revenue-loss analysis | Partial | Partial | Explicit revenue-gap engine | Build |
| Operations/maintenance | Strong | Present | Event/work-order lifecycle | Adapt |
| Reports | Strong | Present | Governance-grade reports | Adapt |
| AI assistant | Strong | Basic | Server-side, tool-driven, read-only | Redesign/adapt |
| Arabic assistant | Strong | Basic | Arabic-first operational intelligence | Adapt |
| AI anti-hallucination | Strong | Partial | Mandatory tool/data boundary | Preserve |
| RBAC | Partial | Strong/hardened | Scope-aware RBAC + separation of duties | Deepen |
| Tenant/project isolation | Partial | Strong | Enforced at DB boundary | Preserve/deepen |
| Governance hierarchy | Partial | Partial | Platform → tenant → project → operation | Build |
| Approval workflows | Partial | Partial | First-class approval engine | Build |
| Exception center | Partial | Partial | Central exception lifecycle | Build |
| Policy engine | Weak/partial | Partial | Configurable water/billing/operation policies | Build |
| Audit/evidence | Partial | Present pieces | Immutable, attributable evidence chain | Deepen |
| Decision engine | Partial | Partial | Explainable recommendations, no autonomous mutation | Build |
| Digital water twin | Not established | Not established | Later-stage model of production/distribution/consumption | Phase 2 |
| Event-driven architecture | Partial | Partial | Domain events for governance/analytics | Build incrementally |
| Production observability | Partial | Present pieces | Release/health/security telemetry | Deepen |
| Migration parity | N/A | Gap | Repository ↔ production contract | Critical |
| ERP functionality | N/A | N/A | Explicitly out of scope | Reject |

## 4. Source-of-truth hierarchy

1. **Production Supabase** — actual production database state.
2. **Target repository** — authoritative application code.
3. **MRX-approved measurements** — authoritative measurement facts for downstream consumption/billing.
4. **Evidence** — photo/location/time/device/context proving field observation.
5. **Reference repository** — read-only feature baseline; never the target source of truth.
6. **AI output** — interpretation/recommendation only; never authoritative data.

## 5. MRX boundary

The measurement pipeline must remain:

```
Image / Field Input
      ↓
Quality Gate
      ↓
OCR / Vision Proposal
      ↓
Meter Identity Verification
      ↓
Reading Validation
      ↓
MRX Capture
      ↓
Approved Reading
      ↓
Billing / Analytics / Decisions
```

No downstream module should treat raw OCR as an approved measurement.

## 6. Governance model

### Scope hierarchy

```
Platform
  └── Tenant
       └── Project
            └── Operational Unit
                 └── Field Event / Asset / Reading
```

### Role families

- Platform administrator
- Tenant manager
- Project manager
- Operations officer
- Meter reader
- Collection officer
- Maintenance officer / technician
- Data exception officer
- Viewer / auditor

The architecture must enforce **separation of duties**. A user should not gain authority merely by reaching a UI route.

### Governance lifecycle

```
Proposed → Validated → Approved → Executed → Verified → Closed
                     ↘ Rejected
                     ↘ Exception
```

## 7. Exception Center

The Exception Center is a first-class MIZAN capability.

Examples:
- meter identity mismatch
- ambiguous OCR
- impossible reading progression
- missing field evidence
- stale reading
- production/consumption inconsistency
- unusual loss
- billing discrepancy
- payment anomaly
- failed synchronization
- policy violation
- authorization conflict

Every exception should have:
**owner + severity + evidence + state + timestamps + resolution + audit trail**.

## 8. Intelligence model

The Intelligence Engine should expose five categories:

1. **Measurement Intelligence** — reading confidence, anomalies, missing evidence.
2. **Water Intelligence** — production, consumption, distribution gap, loss signals.
3. **Revenue Intelligence** — billing, collection, outstanding balances, revenue gaps.
4. **Operations Intelligence** — faults, maintenance, production continuity.
5. **Decision Intelligence** — explainable recommendations based on approved data.

The assistant must be read-only initially. Any future write action requires an explicit authorized workflow, confirmation, policy validation, and audit.

## 9. Immediate gaps to close

### P0 — architecture/security foundations
- Complete governance hierarchy and scope enforcement.
- Complete privilege/RPC review.
- Resolve sequence-table direct mutation exposure.
- Reconcile repository migration history with production.
- Preserve MRX as the only authoritative measurement boundary.
- Verify billing and payment authority against approved readings/events.
- Complete tenant/project isolation tests.

### P1 — MIZAN differentiation
- Build Exception Center.
- Build Approval Engine.
- Build policy engine.
- Build governance audit/evidence model.
- Port the reference server-side assistant/tool model into target-native architecture.
- Add water-loss and revenue-loss intelligence.

### P2 — advanced intelligence
- Domain event model.
- Decision engine.
- Cross-period anomaly detection.
- Digital Water Twin.
- Predictive maintenance and service continuity intelligence.

## 10. Reference integration rule

The reference is a **feature baseline**, not a template to copy wholesale.

Reuse where behavior is already strong:
- OCR
- image quality
- meter verification
- field capture
- offline mechanics
- reading lifecycle
- assistant reasoning/tool patterns

Adapt where target security or architecture differs:
- authentication
- routing
- Supabase access
- billing
- tenant/project scope
- database contracts

Redesign where MIZAN needs stronger institutional behavior:
- governance
- approvals
- exceptions
- policy
- decision support
- audit/evidence chain

Reject:
- ERP framing
- wholesale migration replacement
- wholesale authentication replacement

## 11. Release gates

A capability is not considered production-ready until:

- typecheck passes;
- lint passes;
- production build passes;
- relevant automated tests pass;
- RLS/project isolation is verified;
- authorization is tested at API/database boundaries;
- audit behavior is verified;
- MRX authority is preserved;
- offline behavior is verified when applicable;
- production Supabase state is reconciled before migrations;
- rollback/recovery path is known.

## 12. Decision

The current evidence supports **continuing MIZAN AI**, but not by continuing ad-hoc file-by-file copying.

The correct next workstream is:

```
Blueprint
  ↓
Governance + Security Foundation
  ↓
MRX / Measurement Contract
  ↓
Reference Capability Reconciliation
  ↓
Exception + Approval + Policy Engines
  ↓
Intelligence / Decision Center
  ↓
Production / Field Gate
```

This blueprint is the architectural baseline for subsequent implementation decisions.
