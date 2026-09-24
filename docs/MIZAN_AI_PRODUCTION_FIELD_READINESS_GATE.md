# MIZAN AI — Production & Field Readiness Gate

## Mission
MIZAN AI is a water-service operations, evidence, monitoring, and decision-support platform. It is not an ERP. The production target is reliable field data capture and service sustainability under Yemen's connectivity, power, staffing, and operational constraints.

## Cross-functional delivery teams

1. Water Operations & Utility Engineering — metering, wells, pumps, tanks, distribution, non-revenue water, maintenance workflows; owns operational rules and field acceptance criteria.
2. Field Mobility & Human Factors — offline-first workflows, Arabic UX, low-bandwidth behavior, device constraints, field safety, usability; owns field pilot protocol and recovery procedures.
3. Data, AI/OCR & Evidence Integrity — meter-image evidence, OCR confidence, identity matching, anomaly detection, data quality; AI assists verification and never silently overrides authoritative data.
4. Supabase/PostgreSQL Security & Reliability — RLS, SECURITY DEFINER, authorization ordering, idempotency, transactions, audit immutability, backups/recovery; owns database production gates.
5. Application Engineering & QA — type safety, lint/build, regression coverage, deterministic errors, release discipline; no production claim without reproducible checks.
6. Cybersecurity, Privacy & Audit — least privilege, append-only audit, access review, incident evidence, secrets, data minimization.
7. WASH/Water Quality & Public-Service Governance — service-quality indicators, water-quality evidence, accountability, escalation, vulnerable-user considerations.
8. Yemen Context & Resilience — intermittent connectivity/power, solar-powered sites, distributed teams, conflict/access constraints, localization, Arabic-first operation.
9. Deployment, SRE & Observability — release gates, deployment health, logs, metrics, rollback, backup/restore drills, incident response.

## Non-negotiable production gates

### A. Data integrity
- Every capture has a stable client capture ID.
- Same capture replay is idempotent.
- Meter row locking serializes concurrent captures.
- Authorization occurs before idempotency lookup.
- Reading decreases require an explicit exception path.
- Photo readings require image, OCR value, confidence, model, and meter identity.
- Server remains authoritative.

### B. Offline recovery
- Captures are durably stored before later synchronization.
- Queue items are deleted only after successful server acceptance.
- Network/OCR/runtime failures remain retryable.
- Deterministic business failures become actionable failed items.
- Stale/conflicting captures are quarantined until explicit field verification.
- Conflict resolution requires a verified value and notes and re-enters the server-controlled exception path.

### C. Auditability
- Accepted MRX captures create an atomic audit event.
- Idempotent replay must not create a second production reading or duplicate acceptance event.
- audit_logs is RLS-protected and application users cannot directly mutate it.
- Append-only mutation protection remains enabled.

### D. Security
- SECURITY DEFINER functions use an empty search path and explicit schema qualification.
- Public execution is revoked from sensitive RPCs.
- Project authorization and permission checks occur server-side.
- No client-side permission check is considered sufficient.
- Production data is not used as a test fixture without transaction rollback or dedicated test data.

### E. Field resilience for Yemen
- Offline-first is mandatory for core field capture.
- Image payloads are compressed before queueing.
- The workflow must tolerate intermittent connectivity and power.
- GPS is evidence, not a hard dependency for every capture.
- Arabic and local field terminology are first-class.
- Solar-powered/off-grid water assets are normal deployment scenarios.
- Pilot sites must have a fallback process for device failure and connectivity loss.

## Current release position

- GitHub Actions production checks: PASS (typecheck, lint, production build).
- MRX contract tests were strengthened for audit immutability and idempotency ordering.
- Production Supabase currently has the older MRX implementation; migration 027 has not been applied to Production.
- Therefore migration 027 remains gated until the full database and field-recovery acceptance suite is closed.
- A separate Vercel failure caused by platform build-rate limiting must not be interpreted as an application build failure.

## Release rule

No field-ready declaration is valid until: database migration state matches the release commit; MRX acceptance/rejection/idempotency/exception paths pass; offline recovery and conflict resolution are verified; audit trail and immutability are verified; backup/restore and rollback procedures are documented and exercised; and pilot acceptance is completed on representative Yemen connectivity and power conditions.

## Operating principle

MIZAN AI should optimize for trustworthy evidence, continuity of water-service operations, and decision quality—not feature count.