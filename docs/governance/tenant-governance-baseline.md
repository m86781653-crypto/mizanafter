# MIZAN AI — Tenant Governance & Internal Control Baseline

## Status
Decision baseline for the production authorization redesign. This document separates verified current-state facts from the target operating model.

## 1. Verified current state

- Central tenant exists: `هيئة مياه الريف`, type `main_tenant`, active.
- Sub-tenants are children of the central tenant.
- Current production profiles contain `tenant_id`, `project_id`, `role`, and `must_change_password`.
- RLS is enabled on the core operational tables checked: tenants, profiles, projects, assets, wells, pumps, tanks, customers, meter_readings, invoices, payments, faults, maintenance_work_orders, audit_logs.
- Current UI gives `tenant_manager` access to all 14 application pages. This is broader than the target operating model and must not be treated as the final authorization model.
- Current permission catalog already contains granular permissions such as project.read, project.manage, meter.capture, meter.exception, customer.manage, billing.manage, collection.record, collection.approve, maintenance.manage, maintenance.execute, data.exception, audit.read.
- Current production database has private authorization helpers including mizan_has_permission, mizan_can_access_project and mizan_can_write_project.
- Current subtenant provisioning Edge Function uses a service-role path. This conflicts with the production security requirement for MIZAN and must be redesigned before finalizing provisioning.

## 2. Target organization model

### Central tenant: هيئة مياه الريف
Purpose: governance, oversight, monitoring, portfolio management and controlled provisioning.

Central users must not perform day-to-day subtenant operations through operational pages. Their interface is a governance/oversight workspace.

Central responsibilities:
- Create and activate sub-tenants.
- Register the project and its baseline information.
- Register funding source, donor/financing information and approved financing amount.
- Register baseline infrastructure/assets that are known at setup.
- Provision exactly three operational roles for each sub-tenant.
- Monitor performance, exceptions, service continuity, collections, maintenance, data quality and audit events.
- Review exceptions and control breaches.
- Produce portfolio-level reports.

Central users must not:
- Enter routine meter readings on behalf of field staff.
- Record routine collections on behalf of collectors.
- Approve their own operational transactions.
- Alter operational evidence without an auditable correction workflow.

### Each sub-tenant
Exactly three operational roles:
1. Project Manager — operational management and control.
2. Meter Reader — field meter capture and reading evidence.
3. Collector — collection recording and collection evidence.

## 3. Segregation of duties

| Activity | Project Manager | Meter Reader | Collector | Central Authority |
|---|---|---|---|---|
| Manage project master data | Yes, controlled | No | No | Yes, oversight/setup |
| Capture meter reading | No routine capture | Yes | No | No |
| Correct/exception reading | Review/approve exception | Submit evidence | No | Oversight |
| Register customer | Controlled | No | No | Oversight |
| Record payment/collection | Review | No | Yes | Oversight |
| Approve collection | Yes, subject to separation from own transaction | No | No | Oversight |
| Report fault | Yes | Yes | No | Oversight |
| Create/assign maintenance work | Yes | No | No | Oversight |
| Execute maintenance | No, unless separately authorized | No | No | No dedicated role in the three-user model |
| View reports | Yes | Limited operational | Limited financial/collection | Portfolio-wide |
| View audit trail | Project scope | Own/relevant events | Own/relevant events | Portfolio-wide |
| Provision subtenant users | No | No | No | Yes |
| Change another user's role | No | No | No | No; controlled central/admin workflow |

## 4. Central visibility model

Central oversight should be portfolio-level by default, with drill-down only where needed for supervision.

Central dashboard must expose:
- Active sub-tenants and projects.
- Service availability/interruptions.
- Production and consumption indicators where data quality permits.
- Meter-reading completion and exception rates.
- Billing/collection totals and ageing at portfolio/project level.
- Maintenance open/overdue/resolved counts and response times.
- Critical faults and unresolved service risks.
- Data-quality exceptions.
- Funding/financing baseline and approved amount; actual financial details only to the extent required by the approved reporting model.
- Audit/control exceptions and unusual activity.

Central views should show the source, period, status and data-quality state of each KPI; no derived KPI should be presented as valid when the underlying measurement periods or evidence are incompatible.

## 5. Subtenant visibility

### Project Manager
Needs a complete operational view of their own project, but not central portfolio data or other tenants.

Pages/functions should cover:
- Dashboard
- Project/master data
- Infrastructure/assets
- Subscribers/meters
- Readings review and exceptions
- Billing/collection oversight
- Maintenance/faults
- Reports and loss analysis
- Costs/sustainability
- User status for the three assigned users, without granting arbitrary role administration
- Settings

The Project Manager must not be able to create additional operational users outside the approved three-role model.

### Meter Reader
Only field/reading functions plus the minimum context required to perform them:
- Dashboard
- Reading capture
- Assigned meters/assets
- Reading evidence/history relevant to assigned work
- Reading exceptions/tasks
- Settings/password

Must not access billing, payment approval, user administration or portfolio financial data.

### Collector
Only collection/billing functions plus the minimum context required to perform them:
- Dashboard
- Subscriber/account context needed for collection
- Billing/collection
- Payment recording and collection history within assigned project
- Collection exceptions/tasks
- Settings/password

Must not capture meter readings, approve their own transactions, change tariffs, administer users, or access portfolio-wide data.

## 6. Internal-control rules

1. Least privilege: every role receives only the permissions needed for its duties.
2. Tenant isolation: subtenant users can access only their tenant/project data.
3. Central oversight is not operational impersonation.
4. Maker-checker: actions requiring approval must be approved by a different authorized actor.
5. No self-approval: a user cannot approve a transaction they created.
6. Immutable operational evidence: meter evidence, payment evidence and audit events must not be silently overwritten.
7. Corrections use explicit correction/exception workflows with reason, actor, timestamp and before/after evidence.
8. Role changes are privileged and auditable.
9. Provisioning is auditable and must not expose permanent secrets unnecessarily.
10. Authorization is enforced server-side by RLS/functions; UI hiding is only a usability layer.
11. Reports respect the same tenant and role boundaries as source data.
12. Central reports must distinguish observation, exception and action; the system should not silently convert incomplete data into a performance conclusion.

## 7. Required central reports

- Portfolio service continuity report.
- Project operational performance report.
- Meter-reading compliance and exception report.
- Billing/collection performance report.
- Maintenance monthly report.
- Critical faults and unresolved risks.
- Data-quality/control exceptions.
- Funding/financing portfolio report.
- Audit and access review report.
- Subtenant user/account status report.

## 8. Authorization implementation rule

The authorization source of truth will be the database permission model plus tenant/project scope. React page visibility must be derived from the same permission model and must never grant authority that the database does not grant.

The target role model should separate the central governance role from the subtenant Project Manager role. The exact role code is to be chosen only after checking all existing role constraints/migrations and then migrated consistently.

## 9. Evidence and governance references

The design follows the principle that WASH governance requires clear roles, accountability relationships, monitoring, finance and institutional controls. UNICEF's WASHREG approach explicitly emphasizes identifying regulatory roles and responsibilities, while UNICEF WASH accountability tools map who does what and who responds to whom. WHO/UN-Water GLAAS tracks governance, monitoring, finance and human resources as components of sustainable WASH systems.

References:
- UNICEF WASHREG: https://www.unicef.org/reports/washreg-approach
- UNICEF Accountability in WASH: https://www.unicef.org/documents/accountability-wash-explaining-concept
- WHO/UN-Water GLAAS 2025: https://www.who.int/publications/i/item/9789240120624

## 10. Next implementation gates

A. Complete role/permission/RLS crosswalk for every core table and RPC.
B. Separate central governance role from subtenant Project Manager.
C. Implement database authorization first.
D. Rebuild UI navigation from permissions.
E. Replace service-role provisioning with a documented secure onboarding flow compatible with Supabase Auth.
F. Add automated authorization contract tests for:
   - tenant isolation
   - maker-checker
   - no self-approval
   - three-user provisioning invariant
   - central read-only operational boundary
   - audit completeness.
G. Only after A-F pass, finalize production page design and release.
