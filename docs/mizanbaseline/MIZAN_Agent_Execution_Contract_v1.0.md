# MIZAN AI — AGENT EXECUTION CONTRACT v1.0

## 0. Authority

This document is the execution contract for the coding/building agent. It is subordinate only to explicit newer product decisions from the owner, and otherwise governs discovery, implementation, testing, security review and release preparation.

The product reference describes business behavior and acceptance outcomes. It intentionally does NOT prescribe current repository names, database tables, functions, pages, files, routes, APIs, libraries, or a specific architecture. The agent MUST discover the existing implementation before changing it.

## 0.1 Reference authority and conflict resolution

Before implementation, read `docs/mizanbaseline/MIZAN_REFERENCE_AUTHORITY_INDEX_v1.0.md` and the available authoritative references. Follow the precedence defined there. The latest explicit owner decision controls only where it clearly supersedes an earlier decision; the current code and production state are evidence to inspect, not substitutes for the target product definition.

The owner-approved decision dated 2026-10-15 requires exactly four operational roles per child water-project tenant: `project_manager`, `meter_reader`, `collection_officer`, and `operations_maintenance`. The platform administrator and central governance scope are not child-project operational roles.

If a referenced official document is absent, do not claim to have reviewed it or assume its content. Record the gap. When sources conflict and the precedence rules do not resolve the conflict, pause the affected implementation and request an explicit owner decision. Documentation alignment alone does not authorize changes to application code, schema, production data, or deployment.

## 1. Mission

Turn the current MIZAN implementation into a production-grade water-operations and intelligence platform that faithfully realizes the product reference.

The mission is not to add features for their own sake. The mission is to make the real water-project operating cycle trustworthy, connected, secure, usable in Yemen, and testable end-to-end.

## 2. Non-negotiable rules

1. Do not invent product features, workflows, entities, screens, database structures, or AI capabilities merely because they are technically possible.
2. Do not assume the current code is the product specification. Treat the current implementation as evidence to inspect and reconcile against the reference.
3. Do not prescribe or assume component names. Discover the existing path and select the smallest safe implementation that produces the required business behavior.
4. Preserve tenant/project isolation and enforce authorization at the data/service layer, not only in the UI.
5. Do not silently alter historical facts or closed-period results.
6. Live operational state must update when valid information becomes available; a cycle must not block live updates.
7. Closing a cycle fixes historical results; continuing balances/states move forward by explicit rules.
8. AI output is not authoritative merely because a model produced it.
9. High-impact or uncertain decisions require appropriate human review.
10. Offline capture must not silently lose work; sync and conflict behavior must be observable and recoverable.
11. Every critical result must be traceable to its source evidence and contextual inputs.
12. Security, migrations, authorization and data integrity are release gates, not afterthoughts.
13. A test that only proves a record was inserted is insufficient when the real requirement is an end-to-end business effect.
14. Never merge or modify production destructively without passing the relevant gates and preserving rollback/recovery paths.
15. Prefer small, reversible changes over broad refactors unless the current structure makes the required behavior unsafe or impossible.

## 3. Phase 0 — Discovery, no implementation changes

Inspect the repository, database contract, deployment environment, authentication/authorization behavior, migrations, current data model, current user journeys, tests, CI, observability and release configuration.

Produce a compact current-state map with:
- What is actually implemented.
- What is partially implemented.
- What is missing.
- What is contradictory or unsafe.
- What cannot yet be proven.
- Which current data is production truth versus test/demo data.
- Which changes would be risky.

Do not change product behavior in this phase.

## 4. Phase 1 — Requirement reconciliation

For every requirement in the master reference, classify it as:
- VERIFIED
- PARTIAL
- MISSING
- CONTRADICTORY
- CANNOT BE VERIFIED YET

For every non-VERIFIED requirement, identify the actual current execution path that should be changed. Do not create a new path until you have established that the current path cannot safely support the requirement.

## 5. Phase 2 — P0 first

P0 means any issue that can:
- corrupt or misstate water/financial/operational results;
- break tenant or project isolation;
- permit unauthorized access or mutation;
- lose field data or offline work;
- break continuity across the operating cycle;
- invalidate historical results;
- make a critical operating path unusable;
- or prevent evidence-based verification.

Resolve P0 issues before non-critical enhancements.

## 6. Phase 3 — Prove the real operating cycle

The minimum end-to-end proof must demonstrate the business chain, not merely isolated endpoints:

opening state
→ real operational event
→ capture and evidence
→ validation
→ trusted measurement/result
→ current-state update
→ dependent operational/financial effects when applicable
→ notification/review/action when applicable
→ post-action result when applicable
→ cycle result
→ close/finalize
→ carry-forward of continuing state
→ next-cycle opening state

The exact technical path is to be discovered from the repository and database.

## 7. Phase 4 — Field and offline reliability

Prove:
- field capture works on supported mobile devices;
- images/evidence survive the capture flow;
- identity is checked before a reading is treated as belonging to the intended physical measuring instrument when identity matters;
- manual fallback exists where AI/OCR is uncertain;
- offline capture is durable;
- reconnect/sync is observable;
- duplicates and conflicts do not silently corrupt data;
- users can see what is saved locally and what has synced.

## 8. Phase 5 — AI safety and utility

For every AI-enabled behavior, prove:
- the task has a clear business value;
- structured/rule-based logic is used where sufficient;
- source evidence is preserved;
- model output can be distinguished from verified facts;
- uncertainty/low confidence is handled safely;
- human review is used where impact or uncertainty requires it;
- prompts, tools and retrieved data are scoped to the authorized context;
- agentic actions, if any, are explicitly permissioned and logged;
- cost and latency are monitored;
- degraded/offline behavior is safe.

Use current NIST AI RMF guidance, ISO/IEC 42001/23894 principles and current OWASP GenAI security guidance as security/risk references.

## 9. Phase 6 — Security and governance

Verify at minimum:
- object-level and function-level authorization;
- tenant/project data isolation;
- authentication and session security;
- sensitive data exposure controls;
- input validation and resource limits;
- auditability of high-impact changes;
- secure secrets/configuration;
- safe migrations;
- backup and restore evidence;
- incident response readiness;
- dependency/build integrity;
- current secure-development controls.

Use NIST CSF 2.0, NIST SP 800-218, NIST SP 800-61r3, ISO/IEC 27001:2022, OWASP ASVS 5.0.0 and OWASP API Security Top 10 as references.

## 10. Phase 7 — Arabic/Yemen field usability

Verify the product under realistic constraints:
- Arabic RTL;
- low digital literacy;
- intermittent/slow connectivity;
- low-end Android hardware;
- intermittent electricity;
- field photography;
- limited typing;
- offline operation;
- synchronization after reconnection.

Use WCAG 2.2 as the accessibility baseline while keeping the actual interaction simple enough for the target users.

## 11. Phase 8 — Performance, reliability and sustainability

Measure rather than guess:
- key interaction latency;
- data freshness;
- sync success/failure;
- error rates;
- recovery behavior;
- database/query health;
- AI cost/latency where used;
- cost drivers per tenant/project where applicable;
- resource consumption;
- deploy/rollback safety.

Do not create arbitrary KPI dashboards merely to display these measurements. They exist to operate and improve the product.

## 12. Phase 9 — Evidence package

At the end of implementation, produce an evidence package containing:
1. requirement-to-implementation mapping;
2. P0/P1/P2 status;
3. end-to-end test evidence;
4. negative/security test evidence;
5. offline/sync evidence;
6. AI evaluation evidence where applicable;
7. migration/schema compatibility evidence;
8. deployment verification;
9. remaining risks with explicit severity and owner;
10. release decision.

## 13. Definition of Done — 100%

The work is complete only when:
- every P0 requirement is VERIFIED;
- every critical operating path is proven end-to-end;
- data isolation and authorization are proven with negative tests;
- offline/sync behavior is proven where required;
- historical/period integrity is proven;
- the next-cycle opening state can be traced to the prior-cycle closing result;
- AI-assisted critical paths have evaluation and safety evidence;
- release and rollback are reproducible;
- no critical test result depends on accidental demo/test data;
- all remaining non-P0 gaps are explicitly documented rather than hidden.

## 14. Reporting discipline

When reporting progress, do not provide generic statements such as "implemented" or "fixed" without evidence.

For each meaningful change report:
- business requirement;
- actual current path changed;
- behavior before;
- behavior after;
- tests executed;
- evidence/result;
- side effects checked;
- remaining limitation, if any.

## 15. Stop conditions

Stop and surface the issue rather than guessing when:
- two authoritative data paths disagree about the source of truth;
- a migration could destroy or silently transform production meaning;
- a business rule is absent and materially changes financial/service outcomes;
- an AI model would make an unreviewed high-impact decision;
- authorization boundaries are unclear;
- data recovery cannot be established before a risky change.

Do not solve such uncertainty by inventing product behavior.

## 16. Final operating principle

Build MIZAN so that a real event in a real water project can become trustworthy information, change the correct current state, trigger the right calculation/decision/action when needed, preserve evidence and history, and remain correct when the operating period closes and the next period begins.

That is the acceptance standard for the product.


## 17. Required workflow coverage
Use the workflow library in the master reference as business acceptance scenarios. Do not reinterpret them as a forced technical architecture. For each scenario, identify the actual current implementation path, prove the expected state transitions, and test both successful and failure cases.

## 18. Requirement priority rule
P0 is a release gate. P1 is required for regular operating quality before broad scale where applicable. P2 must not be invented; only explicitly approved product decisions may introduce P2 scope.

## 19. Release gates
Do not declare completion before passing all applicable gates: discovery, data integrity/migrations, security/isolation, full operating cycle, field/offline reliability, AI safety/utility, performance/reliability, and release/rollback readiness.

## 20. Final proof standard
The final evidence package must allow an independent reviewer to start from a real-world event and follow the chain to the resulting current state, decisions/actions, historical period result, carry-forward state, and next-period opening state, while also proving authorization, source evidence, and failure handling.
