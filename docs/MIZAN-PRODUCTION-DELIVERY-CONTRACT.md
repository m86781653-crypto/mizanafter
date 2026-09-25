# MIZAN AI — Production Delivery Contract

## Central tenant

The single active main tenant is **هيئة مياه الريف (Rural Water Authority)**.

The central tenant is a governance/oversight boundary. It can read its child projects through the database authorization layer but does not directly write child operational records.

## Child tenants

Each water project is provisioned as exactly one sub_tenant under the central tenant and receives one project bound to that tenant.

Provisioning creates exactly three operational identities:

1. tenant_manager — مدير المشروع
2. meter_reader — مسؤول قراءة العدادات
3. collection_officer — مسؤول التحصيل

The provisioning service generates credentials server-side using cryptographic randomness. Passwords are not stored in MIZAN tables; Supabase Auth stores the password hash. The initial password is returned only in the provisioning response so the central authority can hand it to the project through a secure channel. Each account is marked must_change_password=true.

## Governance

- Central tenant: oversight and child-project creation.
- Child tenant: operational ownership of its project.
- Database RLS remains authoritative.
- Central tenant may inspect child project records through mizan_can_access_project.
- Child tenant users cannot cross project/tenant boundaries.
- Central tenant does not directly mutate child operational records through normal project RLS.
- Sensitive provisioning is server-side only and the provisioning Edge Function requires JWT authentication.
- Reference repository is read-only and untouched.

## Faults and service interruptions

public.faults remains the fault register.

public.service_interruptions adds production-grade service-stop tracking:

- interruption type
- severity
- lifecycle status
- start/restoration/closure timestamps
- affected subscribers
- estimated water loss
- cause and resolution
- reporter/verifier
- evidence location
- project scope

The table has RLS, least-privilege grants, indexes, audit logging and automatic updated_at.

## Reports and analytics

The project reports page uses live project-scoped data and includes:

- production/consumption
- water-loss indicator
- revenue/collection
- customer/meter coverage
- data quality and anomalies
- faults/maintenance
- service interruptions
- assets
- operational performance
- CSV exports

## Intelligence Engine

For project managers, the dashboard exposes:

OCR → Anomaly Detection → Analytics → AI Assistant → Decision Support

- OCR metrics are derived from meter-reading AI extraction fields.
- Anomaly counts use stored anomaly_flag values.
- Analytics use project-scoped production, consumption, billing and collection data.
- mizan-copilot is a server-side, read-only AI assistant.
- The assistant is authorized per project before reading data.
- AI receives a bounded project data context and cannot execute mutations.
- AI recommendations are explicitly advisory.
- AI activity is written to ai_logs.

## Production boundary

The working branch is:

integration/reference-mirror-sync-complete-v2

The delivery PR is:

#24

The reference repository remains:

n36192655-cloud/mirror-sync-complete

and is not modified.

Supabase production project:

dofteozulbjwnzofcfmo

## Remaining release blockers

Before handing the system to the client:

1. Bootstrap the first central tenant_manager account through the controlled bootstrap path.
2. Verify GEMINI_API_KEY exists and run one authenticated copilot request.
3. Enable leaked-password protection in Supabase Auth settings.
4. Resolve/accept the existing PostGIS spatial_ref_sys and st_estimatedextent advisor findings through a deliberate security review; do not blindly alter PostGIS system objects.
5. Run end-to-end tests with one central user and three child-project users.
6. Verify deployment/build status independently of the current Vercel rate-limit failure.
