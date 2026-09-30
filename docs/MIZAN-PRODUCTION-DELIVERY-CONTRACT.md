# MIZAN AI — Production Delivery Contract

## 1. Scope

MIZAN AI is a production platform for governance, measurement, operation and sustainability of rural water services. It is not an ERP system.

The authoritative production Supabase project is `dofteozulbjwnzofcfmo` (MIZAN AI Production).

## 2. Tenant model

- Platform Owner / Platform Administrator
- Central governance tenant: هيئة مياه الريف بمحافظة تعز
- Child tenant: one rural water project per tenant

All operational data is project-scoped. RLS, RPC authorization, Storage policies, reports, search and audit boundaries must preserve tenant isolation.

## 3. Canonical operational roles

Each child project is provisioned with exactly four operational identities:

1. `project_manager` — مدير المشروع
2. `meter_reader` — قارئ العدادات
3. `collection_officer` — المحصل
4. `operations_maintenance` — مسؤول التشغيل والصيانة

The platform administrator is a technical platform role, not a project operator.

Credentials are never stored in MIZAN application tables. User onboarding uses Supabase Auth and a short-lived onboarding token; initial passwords are not exposed by application APIs.

## 4. Segregation of duties

- Meter readers capture meter evidence; they do not approve financial records.
- Collection officers record payments; approval is controlled separately.
- Operations/maintenance executes field maintenance and interruption evidence.
- Project managers control project configuration and governed approvals.
- Central governance manages project users through scoped database RPCs.
- Direct browser writes to governed operational tables are denied where an authoritative RPC exists.

## 5. Meter identity and evidence

Subscriber meters retain two distinct identities:

- system operational meter number
- physical meter serial number

The physical serial is the field identity used with camera/OCR evidence. A meter reading must remain linked to the correct physical meter.

Production-water meters follow the same distinction. Production evidence requires:

- project/meter-scoped storage path
- photograph
- OCR-derived reading
- OCR confidence
- physical serial identity
- automatic server capture timestamp
- optional GPS evidence

## 6. Water production

Water production is measured independently from subscriber consumption.

The production authority is based on:

`pump_operation_cycles.production_m3`

derived from start/stop production-meter readings.

Production data is not substituted with static `wells.daily_output_m3` values when calculating period production.

## 7. Faults and interruptions

A maintenance fault and an actual service/production interruption are separate records.

When a fault causes an actual interruption:

- report timestamp is preserved
- actual start time is preserved
- an explanation is required when the observed start differs materially from report time
- the interruption is linked to the originating fault

At interruption stop and restart, production-meter evidence can be captured through the governed interruption-evidence RPC. The evidence path is bound to the project, production meter and interruption.

Potential affected production is an estimate based on an available reference production rate and outage duration. It is not labelled as actual water loss.

## 8. Reporting contract

The selected report period is a single start/end date range.

Database reporting functions use an exclusive end boundary internally. The UI converts the user's inclusive end date to the next calendar day without timezone-dependent date arithmetic.

Production, consumption, billing, collection, readings, faults, maintenance and interruptions must use the same selected period semantics.

Operational reporting is the authority for executive KPIs. The water-balance view is security-invoker and uses governed production cycles and valid recorded consumption statuses.

## 9. Analytics and intelligence

MIZAN distinguishes:

- measured production
- recorded consumption
- water-balance gap
- potential affected production
- theoretical coverage equivalent

A water-balance gap is not automatically called final NRW/water loss.

Copilot and dashboards must use the same governed reporting semantics as the operational reports and must not reintroduce legacy production or payment status calculations.

## 10. Security boundary

- No application path uses Supabase `service_role`.
- SECURITY DEFINER functions require authentication/authorization and `search_path=''`.
- Tenant/project isolation is enforced in the database, not only in the UI.
- Storage paths are project-scoped and evidence-specific.
- Legacy direct operational RPCs are retired when replaced by governed lifecycle RPCs.

## 11. Release verification

Before client handoff:

1. Repository migration chain must be reconciled with production migration history/schema.
2. Central governance project loading must use the current authenticated database path.
3. Every active project must have the operational roles required by its contract.
4. Production measurement must pass a complete camera → OCR → evidence → cycle → production flow.
5. Reports must pass boundary tests for the first and last selected dates.
6. Password recovery must be verified against the actual production origin and Supabase redirect configuration.
7. Security and performance advisors must be reviewed after schema changes.
8. Authenticated E2E tests must cover central governance, project users, camera/GPS, storage, billing/collection, reporting and password recovery.
9. Merge and production deployment are prohibited until all release blockers are independently verified.

## 12. Current development branch

The current implementation branch is:

`feature/production-operational-governance-final`

Its review PR is intentionally separate from `main`. Production deployment must not be treated as updated until the branch is merged and a new production deployment is verified.
