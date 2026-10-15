# MIZAN Decision Log — Repository Addendum D-012

**Decision date:** 2026-10-15  
**Status:** Owner-approved decision; repository addendum pending transcription into the original owner-maintained DOCX.  
**Related source:** `MIZAN_Decision_Log_v0.1.docx` (owner-maintained in ChatGPT Library).  
**Related traceability record:** `docs/mizanbaseline/decisions/2026-10-15-four-operational-roles.md`.

> **Provenance:** This is a separately versioned repository addendum, not an edit to or exact mirror of the original DOCX. The original DOCX was not modified by this repository operation. The addendum records the explicit owner-approved decision so repository-based agents can discover it and does not claim that the Library source has been synchronized.

## D-012 — Four operational roles per child water-project tenant

**Domain:** Product governance, tenant provisioning, authorization acceptance criteria.  
**Decision:** Every child water-project tenant must have exactly these four operational roles:

1. `project_manager` — مدير المشروع
2. `meter_reader` — قارئ العدادات
3. `collection_officer` — المحصل
4. `operations_maintenance` — مسؤول التشغيل والصيانة

**Supersedes:** Any earlier statement that a child water-project tenant has exactly three operational roles.

**Boundaries:**
- Platform Administrator is a technical platform role, not a fifth child-project operational role.
- Central Governance is a separate oversight scope, not an additional child-project operational role.
- This decision establishes the target product and authorization model; it does not prove current code, database constraints, RLS/RPCs, UI visibility, or production provisioning already implements it.
- Implementation must follow discovery, authorization review, migration safety, and appropriate tests before any operational changes.

**Reason:** Each child water project requires explicit operational responsibility for project management, meter capture, collection, and operations/maintenance, without silently folding maintenance into the project-manager role.

**Required follow-through:** Transcribe D-012 into the original owner-maintained `MIZAN_Decision_Log_v0.1.docx` (or issue a formally versioned successor) and update repository extracts when the owner source is revised. Until then, this addendum is the repository-visible record of the newer explicit decision.
