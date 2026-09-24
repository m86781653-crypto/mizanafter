# MIZAN AI — Production Architecture Foundation

## Mission
MIZAN AI is a Water Service Operations & Automation Platform, not an ERP.
The target is a production-grade system for real field operation, with automation-first workflows, strong tenant isolation, separation of duties, internal controls, auditability, offline-first field operation, and server-side authoritative calculations.

## Expert Teams

### Team 1 — Water Operations & Automation
- Senior Water Operations Architect — water-service lifecycle and operating model
- Water Operations & O&M Specialist — wells, pumps, storage, distribution, maintenance
- WASH / Water Information Management Specialist — operational data and M&E
- Process Engineer / Business Process Architect — workflow simplification
- Lean Six Sigma / Continuous Improvement Specialist — waste and manual-step reduction
- Field UX/Product Designer — Arabic RTL, low-connectivity and low-friction field UX
- Automation Architect — events, rules, triggers, exceptions, notifications

### Team 2 — Platform, AI & Data Engineering
- Chief Software Architect — target architecture and boundaries
- Senior Full-Stack Engineer — application implementation
- Database & Data Architect — PostgreSQL/Supabase integrity and data model
- AI/ML Engineer — OCR/computer vision/anomaly detection
- Offline/Field Application Engineer — local persistence and sync
- Integration Engineer — APIs and external integrations
- DevOps/Cloud Engineer — CI/CD, observability, backup and recovery

### Team 3 — Quality, Security & Field Readiness
- QA Lead / Test Architect — automated test strategy and release gates
- Security Engineer — authentication, authorization, RLS, secrets, audit
- Data Quality Engineer — integrity and reconciliation
- Water KPI / M&E Specialist — operational indicators
- Field Usability Specialist — real-world field validation
- Disaster Recovery / Reliability Engineer — resilience and recovery
- Acceptance / Pilot Lead — production acceptance and field pilot

## Governance
- Product & Domain Owner
- Chief Solution Architect
- Water Domain Lead
- Automation Lead
- Security & Quality Gate

## Tenant Model
Platform
  -> Main Tenant
     -> Sub-tenant A -> Sub-tenant Manager A
     -> Sub-tenant B -> Sub-tenant Manager B
     -> Sub-tenant C -> Sub-tenant Manager C

Every sub-tenant is an isolated operational boundary. A sub-tenant manager governs only that sub-tenant. Main-tenant oversight is separated from day-to-day sub-tenant operations.

Authorization must be enforced at UI, API/service, and database/RLS layers. Hiding a UI control is never considered security.

## Core Roles (sub-tenant)
1. Tenant Manager
2. Operations Officer
3. Meter Reader
4. Collection Officer
5. Maintenance Officer
6. Technician
7. Data & Exception Officer
8. Viewer/Supervisor

There is NO Accountant role.

## Separation of Duties
Roles are combined with explicit permissions, scope, and approval authority. High-risk incompatible combinations must be blocked by policy.

Examples:
- Meter Reader: capture only; cannot alter approved readings, tariffs, balances or permissions.
- Collection Officer: record collection; cannot alter meter readings, tariffs or historical collection records.
- Operations: operate water infrastructure; cannot alter collection records.
- Technician: execute assigned work; cannot rewrite maintenance history without controlled correction.
- Tenant Manager: management/configuration/controlled approvals within the sub-tenant; not unrestricted super-admin.
- Data & Exception Officer: investigate exceptions; historical corrections require controlled action and audit.

## Approval Policy
Normal meter readings require NO human approval.
A valid reading is automatically accepted after server-side validation.

Human approval is reserved for controlled/high-risk exceptions such as:
- exceptional balance adjustments
- cancellation/voiding of finalized invoices
- changing a meter identity after historical readings exist
- tariff/policy changes where required
- other explicitly governed high-risk actions

## Meter Reading Automation — MRX
Subscriber -> Meter Identity -> Reading Task -> Photo -> automatic GPS/time/device -> meter identity verification -> OCR/vision -> reading validation -> duplicate prevention -> offline queue -> automatic sync -> server validation -> automatic acceptance -> consumption -> tariff -> invoice -> balance/arrears -> KPIs/anomaly detection -> alerts -> audit.

Rules:
- meter identity is entered once when the subscriber/meter is first created or linked
- reader selects subscriber and sees name, meter identity, phone, previous reading/date
- normal action is Capture Photo
- current reading is extracted automatically
- no second approved reading for the same subscriber/meter on the same project business day
- duplicate protection is enforced in the backend, not only the UI
- business date uses the project's configured timezone
- offline capture must sync automatically when connectivity returns
- server is authoritative for final reading, consumption and billing calculations
- low-confidence/unreadable images become exceptions after automated enhancement/retry
- conflicts never overwrite silently

## Automation Principle
Do not ask the user for data the system already knows.
Capture -> Validate -> Enrich -> Calculate -> Decide -> Act -> Notify -> Audit.

## Core Domains
Identity & Access
Tenant Management
Organization & Projects
Users & Roles
Subscribers
Meters
MRX Meter Reading
Consumption
Tariff
Billing
Collection
Arrears
Water Production
Pumping
Energy
Storage
Distribution
Network
Faults
Maintenance
Work Orders
AI & Anomaly Detection
Alerts & Notifications
Reports & KPIs
Audit & Governance
Offline & Synchronization
Integrations
Platform Operations
Security
Backup & Recovery
Observability

## Production Gate
The system is not declared production-ready because screens render or CRUD operations work.
Release requires:
- tenant/data isolation verified
- authorization/RLS verified
- separation-of-duties rules verified
- server-side transactional business rules verified
- MRX end-to-end tests passed
- offline/sync/conflict tests passed
- billing/collection reconciliation passed
- security tests passed
- audit trail verified
- backup/restore and recovery verified
- observability/alerting verified
- automated regression suite passed
- field acceptance passed

## Current Repository Baseline
The current repository contains a React/Vite/TypeScript frontend with Supabase and project-level RLS. The existing implementation is not yet treated as production-ready.

Known architecture gaps requiring remediation:
- current profile model is project-centric rather than main-tenant/sub-tenant hierarchical
- current role list contains an Accountant role, which must be removed
- current RLS helpers are based on a single project_id and do not implement the required tenant hierarchy
- existing sequence tables/functions expose overly broad authenticated policies and require hardening
- current reading UI contains manual reading entry and simulated AI behavior; MRX must become capture-first and server-authoritative
- duplicate/day constraints and transactional reading->billing behavior must be enforced at database/service level
- offline behavior must be a real durable queue/sync architecture, not only navigator.onLine state
- production audit/security controls must be completed and tested

## Implementation Rule
Do not add random pages or features. Each change must map to this architecture, a workflow, a control, a test, and a production acceptance criterion.
