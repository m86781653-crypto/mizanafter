# MIZAN AI — Reference Authority Index v1.0

**Status:** Proposed documentation alignment; not a production release or an implementation specification by itself.  
**Decision date:** 2026-10-15  
**Repository:** `m86781653-crypto/mizanafter`

## Purpose
Define how MIZAN documentation is interpreted when documents disagree. This index does not replace the product owner's official reference files, and it does not claim that files absent from this repository have been reviewed.

## Authority and precedence
1. **Official owner Decision Log, together with explicit newer owner decisions.** A decision supersedes an earlier decision only when the newer entry explicitly identifies what it supersedes. The original `MIZAN_Decision_Log_v0.1.docx` remains in the owner's ChatGPT Library and has not been edited by this repository operation. Its extracted-text mirror is available at `docs/mizanbaseline/official-reference-extracts/MIZAN_Decision_Log_v0.1.extract.md`. The owner-approved 2026-10-15 four-role decision is recorded as repository addendum D-012 at `docs/mizanbaseline/official-reference-extracts/MIZAN_Decision_Log_Addendum_2026-10-15.md`, with a traceability record at `docs/mizanbaseline/decisions/2026-10-15-four-operational-roles.md`. The addendum is not represented as an edit to or synchronized copy of the original DOCX; it must be transcribed into the owner-maintained source or a formally versioned successor.
2. **`MIZAN_Master_Reference_v0.1.docx`** — intended product behavior and product boundaries.
3. **`MIZAN_Current_System_Baseline_v0.1.docx`** — dated evidence of the system's observed state, not proof of current state without re-verification.
4. **`docs/mizanbaseline/MIZAN_Master_Product_Reference_v1.0.docx`** — supplementary product/engineering reference, subordinate to the three owner-designated official references and explicit owner decisions. It does not replace `MIZAN_Master_Reference_v0.1.docx`, `MIZAN_Current_System_Baseline_v0.1.docx`, or `MIZAN_Decision_Log_v0.1.docx`.
5. **`docs/mizanbaseline/MIZAN_Master_Product_Reference_v1.0.md`** — repository-readable engineering derivative. Until the documented crosswalk is closed and the owner approves synchronization, it must not silently supersede the corresponding DOCX; substantive differences must be recorded and resolved explicitly.
6. **`docs/mizanbaseline/MIZAN_Agent_Execution_Contract_v1.0.md`** — discovery, implementation, testing, evidence, and release execution rules; it does not independently redefine product behavior.
7. **Architecture, production-delivery, governance, and integration documents** — authoritative only within their stated scope and only when consistent with items 1–6.
8. **Code, database schema, deployments, logs, and tests** — evidence of what currently exists or has been verified; they do not silently redefine intended product behavior.

## Four-role operational decision
Each child water-project tenant must be provisioned with these four operational roles:
- `project_manager` — مدير المشروع
- `meter_reader` — قارئ العدادات
- `collection_officer` — المحصل
- `operations_maintenance` — مسؤول التشغيل والصيانة

The Platform Administrator is a technical platform role, not a fifth project-operational role. Central Governance is a separate oversight scope, not an additional child-project operational role.

## Required reference files and mirror status
The owner-designated official source files are:
- `MIZAN_Master_Reference_v0.1.docx`
- `MIZAN_Current_System_Baseline_v0.1.docx`
- `MIZAN_Decision_Log_v0.1.docx`

The original DOCX binaries are maintained in the owner's ChatGPT Library and were not present in the repository inventory reviewed for this change. To make their content available to repository-based agents, extracted-text mirrors have now been added:
- `docs/mizanbaseline/official-reference-extracts/MIZAN_Master_Reference_v0.1.extract.md`
- `docs/mizanbaseline/official-reference-extracts/MIZAN_Current_System_Baseline_v0.1.extract.md`
- `docs/mizanbaseline/official-reference-extracts/MIZAN_Decision_Log_v0.1.extract.md`

These are explicitly labeled text extractions, not original DOCX files or byte-identical copies; Word layout and table formatting may not be fully preserved. The original Library documents remain the authoritative source files. The extracted mirrors should be rechecked against the originals after any source revision, and no claim of exact formatting/content parity should be made without comparison.

The repository's `docs/mizanbaseline/MIZAN_Master_Product_Reference_v1.0.docx` and its Markdown counterpart must also be content-compared before they are treated as equivalent.

## Conflict handling
- Do not resolve a substantive product conflict by silently choosing whichever document is easiest to edit.
- Record the conflict, identify the affected behavior, and request an explicit owner decision if this index and the available authoritative sources do not resolve it.
- Keep current-state observations separate from target requirements.
- Do not change application code, database schema, production data, or deployment state merely to resolve a documentation conflict.
- A pull request containing reference-alignment changes must state the files changed, the conflict resolved, the evidence checked, and any remaining unverified items.

## Reference verification checkpoint — 2026-10-17

The following documentation-only checks have since been completed and recorded in the crosswalk and parity audit:

- The owner Product Reference DOCX and repository Markdown have corresponding top-level sections 1–19.
- Section 17 in both formats contains the P0-01–P0-22 and P1-01–P1-15 catalogs and the P2 policy. Mixed Arabic/Latin identifier reversal in extracted text is an extraction/rendering issue, not evidence that the identifiers are absent from the DOCX.
- Section 18 in both formats contains quality/release gates 0–7. These must be distinguished from the separate execution stages 0–8 and 100% completion gate in DOCX section 15.
- Eight duplicated goal labels in the repository Markdown gate descriptions were corrected to match the source DOCX wording. The owner DOCX was not modified; no gate meaning was changed.
- The Product Reference crosswalk remains **OPEN** for complete semantic comparison of workflows, tables, exact wording, acceptance criteria, exceptions, and RTL/LTR presentation.
- Decision D-012 (four operational roles) remains a separate repository addendum pending transcription into the owner-maintained Decision Log DOCX or issuance of a formally versioned successor. It does not authorize production changes by itself.
- The completed owner-approved MIZAN AI — MASTER EXECUTION PROMPT v2.0 remains not located/verified. The similarly named Library outline is not a completed execution specification, and the Agent Execution Contract v1.0 is a distinct artifact.

These findings establish specific verified documentation facts only. They do not establish application, database, authorization, or production-deployment conformance. No application code, production database, production data, grants, migration history, or deployment state was changed during this checkpoint.
## Deployment-check visibility note — 2026-10-17

The combined GitHub status for documentation commit `478879c4fd0f2404f7b80a7b455948d05e4e88c4` reports three Vercel contexts: `Vercel – mizanafter` = failure, `Vercel – mizanafter-gojh` = failure, and `Vercel – mizanafterv1` = success. The status links point to deployments under Vercel scopes `nezarmofeedalsalami-9484s-projects` and `mofeed1`. Attempts to retrieve deployment details/listings were denied with HTTP 403 for both scopes. Therefore, the check states are visible but the causes, deployment source SHAs, and whether the failed projects are customer-facing aliases are not verified. Do not infer application build failure from these statuses alone, and do not change Vercel project links, domains, or deployment configuration without the account owner establishing authorized scope and confirming the canonical production project.

