# MIZAN AI — Yemen Field Acceptance Protocol

## Objective

Validate MIZAN AI under representative water-service operating conditions before production field deployment.

This is a field acceptance protocol, not a demo checklist.

## Test environment

The pilot should include:

- at least one active water project;
- representative subscriber meters;
- at least one well/pump or production meter where available;
- Android field devices representative of actual operators;
- Arabic-first interface usage;
- intermittent mobile connectivity;
- a period of low or unavailable connectivity;
- intermittent charging/power conditions;
- a solar/off-grid operating scenario where available;
- GPS unavailable or denied;
- low-bandwidth image upload;
- device/browser restart during queued work.

## Acceptance scenarios

### A. Online capture

1. Capture a meter photograph.
2. Verify OCR reading and meter identity.
3. Verify server-side validation.
4. Verify exactly one meter_readings row.
5. Verify exactly one accepted MRX audit event.
6. Repeat the same client_capture_id and verify idempotent replay.

### B. Offline capture

1. Disable connectivity.
2. Capture one or more readings.
3. Confirm each capture remains in durable local storage.
4. Restart the browser/device.
5. Restore connectivity.
6. Verify queued captures synchronize without duplication.
7. Verify successful captures are removed only after server acknowledgement.

### C. Conflict

1. Capture a reading offline.
2. Advance the same meter through another authorized capture.
3. Synchronize the stale capture.
4. Verify the stale capture is quarantined.
5. Verify the newer server reading is not overwritten.
6. Resolve only through the explicit manual-exception path.
7. Verify resolution notes and authorization are enforced server-side.
8. Verify one resulting production reading and one audit event.

### D. OCR and identity

1. Test Arabic/Persian digit normalization.
2. Test a valid meter identity.
3. Test a different meter identity.
4. Test low-confidence OCR.
5. Test unreadable image.
6. Test reading mismatch between OCR and submitted value.

No client-side OCR result is authoritative by itself; the server must revalidate the submitted evidence.

### E. GPS and device failure

1. Deny GPS permission.
2. Complete a valid capture without GPS.
3. Kill/restart the browser during capture.
4. Confirm the queue survives.
5. Repeat with connectivity interruption during synchronization.

GPS is evidence when available, not a hard dependency for every reading.

### F. Power/connectivity resilience

Run a representative capture sequence through:

- connected → disconnected;
- disconnected → connected;
- low bandwidth;
- temporary DNS/network failure;
- device restart;
- browser tab/process termination.

The expected result is durable evidence with deterministic retry behavior and no duplicate production records.

## Acceptance evidence

For each scenario record:

- timestamp;
- project/meter identifier;
- device/browser;
- connectivity state;
- capture ID;
- expected result;
- observed result;
- screenshots/log references where appropriate;
- pass/fail;
- corrective action.

## Release rule

The field deployment gate remains open until all mandatory scenarios pass on representative Yemen operating conditions and the evidence is reviewed by operations, field/HF, security, QA, and the deployment/SRE teams.
