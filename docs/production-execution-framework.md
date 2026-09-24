# MIZAN AI — Scope & Production Execution Framework

## Non-Negotiable Operating Rule
MIZAN AI is a real production Water Service Operations & Automation Platform.
Work must remain inside the agreed framework. No scope expansion, speculative features, ERP functions, or unnecessary modules.

## Scope Gate
Every proposed change must satisfy at least one of:
1. Required for a core water-service workflow.
2. Required for automation of an existing workflow.
3. Required for security, authorization, tenant isolation, governance, or separation of duties.
4. Required for data integrity or regulatory/operational traceability.
5. Required for offline field operation and synchronization.
6. Required for reliability, observability, backup, recovery, or production deployment.
7. Required to pass an explicit production acceptance test.

If none applies: DO NOT BUILD IT.

## Product Boundary
MIZAN is not ERP.
Do not add:
- HR/payroll
- general ledger/accounting
- generic procurement
- generic inventory
- generic CRM/sales
- manufacturing
- generic project management
- unrelated asset management

Financial scope is limited to water-service economics:
consumption, tariff, billing, collection, arrears, and operating-cost indicators directly required for water operations.

## Execution Order
1. Freeze target architecture and scope.
2. Audit current repository against target.
3. Build gap register.
4. Establish tenant hierarchy and authorization model.
5. Establish RBAC + permission + scope + policy model.
6. Establish separation-of-duties and internal-control rules.
7. Establish database integrity and RLS.
8. Establish audit trail.
9. Implement/verify core water-service workflows.
10. Implement MRX meter-reading automation.
11. Implement consumption, tariff, billing, collection and arrears automation.
12. Implement operations, faults and maintenance workflows.
13. Implement offline-first and automatic synchronization.
14. Implement required AI/OCR/anomaly capabilities.
15. Add automated tests and security tests.
16. Validate backup/recovery/observability.
17. Run field simulations.
18. Run production gate.
19. Release only after all mandatory gates pass.

## Definition of Done
A feature/workflow is done only when:
- business rules are explicit;
- authorization is enforced server-side;
- data isolation is enforced at database level where applicable;
- audit behavior is defined;
- offline behavior is defined where field use requires it;
- failure/exception paths are defined;
- automated tests exist for critical behavior;
- production acceptance criteria pass.

## Change Discipline
Do not redesign unrelated areas while implementing a workflow.
Do not add a page merely because a backend capability exists.
Prefer one complete workflow over many partial screens.
Prefer automation over manual forms.
Prefer server-authoritative calculations over client calculations.
Prefer exceptions over routine approvals.
Never claim production readiness without passing the production gate.

## Current Workstream
The immediate workstream is architecture/security/data foundation, followed by MRX and the core water-service transaction chain.
