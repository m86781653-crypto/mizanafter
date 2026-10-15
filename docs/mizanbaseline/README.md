# MIZAN Reference Baseline — Start Here

**Purpose:** Entry point for any human or AI agent working on MIZAN. This file is navigation only; it does not create or override product requirements.

## Required reading order

1. **Reference authority and conflict rules:** `MIZAN_REFERENCE_AUTHORITY_INDEX_v1.0.md`.
2. **Official owner references (repository text extracts):**
   - `official-reference-extracts/MIZAN_Master_Reference_v0.1.extract.md`
   - `official-reference-extracts/MIZAN_Current_System_Baseline_v0.1.extract.md`
   - `official-reference-extracts/MIZAN_Decision_Log_v0.1.extract.md`
   - The original DOCX files remain the owner-maintained sources in the owner's ChatGPT Library; extracts are not byte-identical copies.
3. **Newer explicit owner decision:** `official-reference-extracts/MIZAN_Decision_Log_Addendum_2026-10-15.md` (D-012), plus traceability at `decisions/2026-10-15-four-operational-roles.md`. The addendum must be transcribed into the owner-maintained Decision Log or a formally versioned successor.
4. **Supplementary product reference:** `MIZAN_Master_Product_Reference_v1.0.docx` is the source document for its repository Markdown counterpart. Read `MIZAN_PRODUCT_REFERENCE_CROSSWALK_v1.0.md` and `MIZAN_REFERENCE_PARITY_AUDIT_v1.0.md` before treating the DOCX and Markdown as equivalent. Semantic parity is not yet closed.
5. **Execution rules:** `MIZAN_Agent_Execution_Contract_v1.0.md`.
6. **Scoped architecture/governance documents:** read only when relevant, and apply the precedence in the authority index.

## Current role decision

Every child water-project tenant must have these four operational roles:

- `project_manager`
- `meter_reader`
- `collection_officer`
- `operations_maintenance`

Platform Administrator is a technical role. Central Governance is a separate oversight scope; neither is a fifth child-project operational role.

## Rules for agents

- Do not silently select a convenient source when documents differ.
- Do not claim extracted text is identical to a DOCX source.
- Treat the Current System Baseline as dated evidence, not current truth until re-verified.
- Treat code, database, deployment, logs, and tests as evidence of implementation, not authority to redefine the product.
- Record unresolved conflicts and do not implement a product decision that has not been authorized.
- This documentation baseline does not itself authorize code, database, production-data, or deployment changes.
