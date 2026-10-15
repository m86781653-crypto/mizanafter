# MIZAN AI — Reference Authority Index v1.0

**Status:** Proposed documentation alignment; not a production release or an implementation specification by itself.  
**Decision date:** 2026-10-15  
**Repository:** `m86781653-crypto/mizanafter`

## Purpose
Define how MIZAN documentation is interpreted when documents disagree. This index does not replace the product owner's official reference files, and it does not claim that files absent from this repository have been reviewed.

## Authority and precedence
1. **Official owner Decision Log, when available, together with explicit newer owner decisions.** A decision supersedes an earlier decision only when the newer entry explicitly identifies what it supersedes. The official file `MIZAN_Decision_Log_v0.1.docx` was not present in the repository inventory reviewed for this change. The decision dated 2026-10-15 is separately recorded for traceability at `docs/mizanbaseline/decisions/2026-10-15-four-operational-roles.md`; that record is not represented as a synchronized copy of the missing official Decision Log.
2. **`MIZAN_Master_Reference_v0.1.docx`** — intended product behavior and product boundaries.
3. **`MIZAN_Current_System_Baseline_v0.1.docx`** — dated evidence of the system's observed state, not proof of current state without re-verification.
4. **`docs/mizanbaseline/MIZAN_Master_Product_Reference_v1.0.md`** — detailed engineering acceptance reference, subordinate to the owner decision and official master reference.
5. **`docs/mizanbaseline/MIZAN_Agent_Execution_Contract_v1.0.md`** — discovery, implementation, testing, evidence, and release execution rules; it does not independently redefine product behavior.
6. **Architecture, production-delivery, governance, and integration documents** — authoritative only within their stated scope and only when consistent with items 1–5.
7. **Code, database schema, deployments, logs, and tests** — evidence of what currently exists or has been verified; they do not silently redefine intended product behavior.

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
