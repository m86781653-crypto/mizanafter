# MIZAN AI — Backup, Restore & Disaster Recovery Runbook

## Purpose

This runbook defines the minimum recovery controls required before MIZAN AI is declared field-production ready.

MIZAN AI is a water-service operations platform, not an ERP. Recovery must protect meter evidence, readings, audit history, billing/collection state, authorization data, and the ability to resume field operations after connectivity or infrastructure failure.

## Recovery objectives

The deployment must explicitly agree target values for:

- RPO: maximum acceptable data loss window.
- RTO: maximum acceptable service restoration window.

Until an operator approves numeric targets, the release gate remains open.

## Database recovery

Supabase provides daily database backups on supported paid plans and offers Point-in-Time Recovery (PITR) for finer-grained recovery. PITR should be evaluated against the project's RPO rather than enabled blindly.

Required verification:

1. Identify the production backup/PITR configuration.
2. Record retention and the intended RPO.
3. Restore a recent backup to a non-production project when the platform plan permits.
4. Verify schema, migrations, RLS, functions, triggers, audit immutability, and representative data.
5. Verify that audit_logs and meter_readings are internally consistent after restore.
6. Record restore duration and compare it with the approved RTO.
7. Exercise rollback of the application to the last known-good release.

## Storage recovery

Database backups do not contain objects stored through the Supabase Storage API. Meter photographs therefore require an independent recovery plan.

Required verification:

- enumerate production storage buckets used by MIZAN;
- document retention and backup/export procedure for meter evidence;
- test recovery of representative images;
- verify recovered image URLs/objects remain usable by the application;
- document the failure mode when an image is unavailable.

## Field continuity

When the central service is unavailable:

- field capture must remain durable in IndexedDB;
- each capture must retain a stable client_capture_id;
- no capture may be silently discarded;
- retries must be idempotent;
- stale/decreasing readings must enter conflict quarantine;
- successful server acknowledgement is the point at which a local capture may be deleted.

## Incident sequence

1. Declare the incident and record UTC start time.
2. Protect evidence and stop destructive maintenance.
3. Determine whether the failure is application, database, storage, network, or identity related.
4. Preserve the field queue and client capture IDs.
5. Restore infrastructure using the approved recovery path.
6. Verify migrations and authorization before reopening write traffic.
7. Run MRX smoke/E2E checks.
8. Reconcile queued field captures.
9. Verify audit continuity.
10. Record RPO/RTO achieved, data gaps, and corrective actions.

## Release gate

MIZAN AI is not considered DR-ready until a documented restore exercise has produced evidence for database recovery, storage evidence recovery, application rollback, MRX replay, and audit continuity.
