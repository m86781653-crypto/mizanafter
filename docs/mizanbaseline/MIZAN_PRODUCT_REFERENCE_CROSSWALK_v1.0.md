# MIZAN Master Product Reference DOCX/Markdown Crosswalk v1.0

**Date:** 2026-10-15  
**Status:** Structural mapping completed; semantic parity remains OPEN.  
**Sources compared:** Owner Library `MIZAN_Master_Product_Reference_v1.0.docx` and repository `docs/mizanbaseline/MIZAN_Master_Product_Reference_v1.0.md`.

## Purpose and method

This crosswalk records the section-level structure visible in the DOCX text extraction and the repository Markdown. The DOCX extraction includes page headers, page numbers, line wraps, and possible table/layout artifacts. Accordingly, this is a structural map, not proof that every sentence, requirement, priority, example, citation, or table is equivalent.

## Section mapping

| # | DOCX section (Arabic title as extracted) | Markdown section | Structural result |
|---|---|---|---|
| 1 | تعريف المشكلة والحل | `1. تعريف المشكلة والحل` | Corresponding section found |
| 2 | النموذج التشغيلي | `2. النموذج التشغيلي` | Corresponding section found |
| 3 | السيناريوهات الشاملة | `3. السيناريوهات الشاملة` | Corresponding section found |
| 4 | إطار مواصفة سير العمل | `4. إطار مواصفة سير العمل` | Corresponding section found |
| 5 | مواصفة دورة التشغيل الكاملة | `5. مواصفة دورة التشغيل الكاملة` | Corresponding section found |
| 6 | نموذج المعلومات والبيانات المرجعي | `6. نموذج المعلومات والبيانات المرجعي` | Corresponding section found |
| 7 | نموذج الذكاء والأتمتة | `7. نموذج الذكاء والأتمتة` | Corresponding section found |
| 8 | نموذج الحوكمة والمسؤولية | `8. نموذج الحوكمة والمسؤولية` | Corresponding section found |
| 9 | نموذج تجربة المستخدم والتفاعل | `9. نموذج تجربة المستخدم والتفاعل` | Corresponding section found |
| 10 | نموذج الأداء والاستدامة | `10. نموذج الأداء والاستدامة` | Corresponding section found |
| 11 | نموذج التقارير والتحليل ودعم القرار | `11. نموذج التقارير والتحليل ودعم القرار` | Corresponding section found |
| 12 | المبادئ الحاكمة لـ MIZAN | `12. المبادئ الحاكمة لـ MIZAN` | Corresponding section found |
| 13 | خريطة القدرات المرجعية | `13. خريطة القدرات المرجعية` | Corresponding section found |
| 14 | المتطلبات المرجعية القابلة للتحقق | `14. المتطلبات المرجعية القابلة للتحقق` | Corresponding section found |
| 15 | المواصفة النهائية للمنتج وحزمة بدء العمل | `15. المواصفة النهائية للمنتج وحزمة بدء العمل` | Corresponding section found |

The DOCX and Markdown share the same 19 top-level product-reference sections, including the 22-workflow library (section 16), requirements catalog (section 17), quality/release gates (section 18), and reference/change governance (section 19). This establishes structural correspondence, not by itself exact semantic equivalence.

## Required semantic review before declaring parity

Review each paired section in full and compare:

1. The intended product behavior and scope boundaries.
2. Mandatory rules, prohibitions, and exceptions.
3. Every explicit requirement ID, priority, acceptance criterion, and definition of nonconformity.
4. Operational scenarios, workflow stages, lifecycle transitions, and period-closing/rollover rules.
5. Data, evidence, identity, auditability, offline synchronization, and authorization requirements.
6. AI automation boundaries, human review requirements, safety controls, and cost constraints.
7. Performance, reliability, sustainability, reporting, and decision-support requirements.
8. Tables, lists, citations, footnotes, appendices, and any content not faithfully represented in text extraction.
9. Any additional statement in one format that is absent from the other, including version/status language or implementation instructions.

For each difference, classify it as formatting/extraction noise, harmless editorial change, clarification, substantive requirement difference, or unresolved conflict. Substantive differences must be resolved by the product owner and recorded in the Decision Log before one format is declared a synchronized mirror.

## Additional structure and unmatched headings

### Corrected structural mapping

The full 25-page DOCX was re-read through its final pages (including pages 22–25), and the repository Markdown headings were enumerated directly. The DOCX **does contain** sections 17–19 as independent top-level sections, corresponding to Markdown sections 17–19. The earlier statement that these headings were absent from the DOCX extraction was incorrect and is superseded by this correction.

- Section 16: `مكتبة مواصفات سير العمل` — both formats contain 22 workflow specifications.
- Section 17: `قاموس المتطلبات المرجعية` — both formats contain P0-01–P0-22 and P1-01–P1-15, plus the P2 policy. The Word text extraction reverses/distorts some Arabic/Latin ordering (for example, the priority labels), so visual confirmation remains appropriate for ambiguous table/layout details.
- Section 18: `بوابات الجودة والإطلاق` — both formats contain gates 0–7.
- Section 19: `إدارة المرجع والتغيير` — both formats contain this section.

Thus, the earlier claim of a standalone-section mismatch for 17–19 is withdrawn. Semantic comparison of exact wording, tables, criteria, and exceptions remains necessary.

| Markdown section | Possible DOCX location | Status |
|---|---|---|
| 16. مكتبة مواصفات سير العمل | DOCX section 16 | Corresponding section found |
| 17. قاموس المتطلبات المرجعية | DOCX section 17, `قاموس المتطلبات المرجعية` | Matching top-level section and numbered P0/P1 catalog are present in both; exact wording and RTL extraction artifacts still require semantic review |
| 18. بوابات الجودة والإطلاق | DOCX section 18, `بوابات الجودة والإطلاق` | Matching top-level section and gates 0–7 are present in both; compare each gate's exact acceptance criteria with DOCX section 15's separate execution stages 0–8 and 100% completion gate |
| 19. إدارة المرجع والتغيير | DOCX section 19, `إدارة المرجع والتغيير` | Matching top-level section is present in both; compare each rule, especially owner authority, versioning, and no silent product-definition changes |

### Execution-stage crosswalk: DOCX section 15 vs Markdown section 18

| DOCX method stage | Markdown gate | Assessment |
|---|---|---|
| 0 — Discovery | Gate 0 — Discovery | Direct conceptual match |
| 1 — Alignment: classify every reference requirement as matching/partial/missing/contradictory/unprovable | No distinct named gate; requirement reconciliation is partly represented in the broader reference workflow | Potentially under-specified as a release gate; verify intended coverage |
| 2 — P0 repair | Gate 1 — Data safety and Gate 2 — Security/isolation, plus the P0 catalog | Split/reorganized; not a one-to-one match |
| 3 — Prove the complete operating cycle | Gate 3 — Complete cycle | Direct conceptual match |
| 4 — Security and governance | Gate 2 — Security/isolation | Broad match; confirm backup, secrets, audit, and incident-response coverage |
| 5 — Field/offline | Gate 4 — Field/offline | Direct conceptual match |
| 6 — AI | Gate 5 — AI | Direct conceptual match |
| 7 — Performance/sustainability | Gate 6 — Quality/performance | Broad match; confirm explicit sustainability/recovery scope |
| 8 — Release | Gate 7 — Release | Direct conceptual match |

The gate crosswalk remains a separate comparison between two different structures: DOCX section 15's execution method (stages 0–8, including stage 1 requirement alignment) and DOCX/Markdown section 18's quality gates (gates 0–7). These are distinct mechanisms in the source itself. Do not describe the absence of a named gate 1 alignment as a missing section in the Markdown; instead verify how requirement alignment is enforced before implementation and release.

### Requirement-level semantic crosswalk (candidate mapping)

This table maps the Markdown's existing requirement IDs to concepts found in the extracted DOCX. It does not create new requirements or certify equivalence. “Direct concept” means a matching concept is visible in the extraction; “Partial/combined” means the concept appears but is grouped differently or needs a visual source check.

#### P0 requirements

| Markdown ID | DOCX conceptual anchor | Candidate status |
|---|---|---|
| P0-01 | Sections 8 and 12: isolation, access boundaries, security starts at data | Direct concept |
| P0-02 | Sections 8, 12 and 14: authorization, security and negative testing | Direct concept |
| P0-03 | Sections 4 and 6: project/site/time context and minimum data context | Direct concept |
| P0-04 | Sections 2, 4, 6 and 12: evidence linked to events, results and source | Direct concept |
| P0-05 | Sections 6 and 7: source of truth, extracted data, derived results, AI not automatic truth | Direct concept |
| P0-06 | Sections 6, 7 and 14: validation, measurement identity and test evidence | Partial/combined |
| P0-07 | Sections 2, 5 and 12: current state changes during continuous operation, not only at period close | Direct concept |
| P0-08 | Sections 5 and 12: current state distinguished from historical record | Direct concept |
| P0-09 | Sections 2, 5 and 14: operational-period closure fixes historical results | Direct concept |
| P0-10 | Sections 5 and 14: continuity and transition to the next period | Direct concept |
| P0-11 | Sections 4 and 9: offline capture, local preservation and continuity under connectivity loss | Direct concept |
| P0-12 | Sections 4 and 9: synchronization, conflict handling and safe retry | Direct concept |
| P0-13 | Sections 4, 6 and 13: service/usage → entitlement → payment → balance | Direct concept |
| P0-14 | Sections 8 and 12: ownership, context, timestamp and historical effect for important changes | Direct concept |
| P0-15 | Sections 8 and 14: data governance, least data, secrets and security | Partial/combined; verify exact control coverage |
| P0-16 | Section 12: sensitive changes require a safe, reversible migration | Direct concept |
| P0-17 | Sections 8 and 14: backup, restore and evidence before release | Direct concept |
| P0-18 | Sections 4, 5 and 12: failures must preserve data/context and cannot count as complete success | Direct concept |
| P0-19 | Section 14: negative authorization tests and proof of isolation | Direct concept |
| P0-20 | Sections 2, 4, 14 and 15: end-to-end operating cycle, period closure and next-period effects | Direct concept |
| P0-21 | Sections 7 and 8: AI risk controls, human review and stop/revert mechanism | Direct concept |
| P0-22 | Sections 6, 7 and 11: critical values tied to source, context, method and evidence | Direct concept |

#### P1 requirements

| Markdown ID | DOCX conceptual anchor | Candidate status |
|---|---|---|
| P1-01 | Sections 6, 13 and 14: baseline/current context and tracking the actual system before implementation | Partial/combined; verify the exact “existing vs new project” formulation |
| P1-02 | Sections 6 and 10: asset capacity, condition and operational context | Partial/combined; confirm design/operational/actual capacity distinctions |
| P1-03 | Section 11: important numbers need definition, period, context, source and calculation method | Direct concept |
| P1-04 | Sections 4, 7 and 11: detect abnormal conditions, explain significance and support action | Direct concept |
| P1-05 | Sections 4, 11 and 13: operating, period, maintenance and collection reporting | Direct concept |
| P1-06 | Sections 4 and 11: multi-project aggregate view with authorized drill-down to source | Direct concept |
| P1-07 | Section 9: Arabic field usability, short workflows and reduced typing | Direct concept |
| P1-08 | Section 9: WCAG 2.2 as the accessibility basis | Direct concept |
| P1-09 | Sections 3, 9 and 14: Yemen field constraints, limited connectivity/devices and performance | Direct concept |
| P1-10 | Sections 9 and 10: availability, sync success, failure, recovery time, freshness and cost monitoring | Direct concept |
| P1-11 | Section 7: AI assistant grounded in authorized organizational data and context, distinguishing fact/inference/recommendation | Direct concept |
| P1-12 | Sections 7 and 8: AI quality evaluation, review outcomes and risk management | Partial/combined; verify whether correction-rate measurement is explicitly required |
| P1-13 | Sections 9 and 14, stage 4: recovery, continuity and incident response | Direct concept |
| P1-14 | Section 8: data ownership, retention, export and continuity when changing provider | Direct concept |
| P1-15 | Section 8: accountable owner, context, time and historical effect for important decisions/changes | Direct concept |

#### Interpretation rules

1. These rows map **concepts**, not identical wording. The DOCX extraction has layout/OCR artifacts, so all partial mappings and any decision that affects scope must be checked against the original DOCX visually.
2. The DOCX section 17 contains the same P0-01–P0-22 and P1-01–P1-15 requirement catalog as Markdown. The Word extraction reverses the visual order of mixed Arabic/Latin labels (for example, P0-01 may appear as 01 0 - P); compare the Arabic requirement text and inspect rendered pages for any ambiguous label. Do not classify the IDs as Markdown-only content.
3. Do not infer that a mapped concept is already implemented in the application or database.
4. The product owner must resolve whether the Markdown's explicit IDs and any extra specificity are approved engineering elaborations, or must be revised to match the owner source more closely.

### Material differences to resolve

1. The DOCX section 17 and Markdown section 17 contain the same numbered P0/P1 catalog and P2 policy. Compare exact Arabic wording and priority labels, especially where Word's RTL/LTR text extraction reverses the visible identifier order; do not treat the IDs as a Markdown-only elaboration.
2. The Markdown introduces eight named quality/release gates (0–7). The DOCX describes a nine-step execution method (0–8) and a “100% completion” gate. The concepts broadly overlap, but their grouping, numbering, and labels differ; map each stage and confirm whether this is an intentional restructuring or an unintended requirement change.
3. Both formats have a standalone section 19 on reference/change governance. Compare the rules for versioning, decision supersession, owner authority, and preventing silent product changes.
4. The DOCX extraction includes page headers, line-wrap artifacts, and mixed RTL/LTR ordering distortions. These artifacts can make labels appear reversed even when the underlying requirement text matches. Inspect the original DOCX pages for ambiguous wording, tables, punctuation, and layout before final classification.

Until these differences are resolved, treat the Markdown as a detailed engineering reference with possible elaborations—not as a verified exact mirror of the Product Reference DOCX.

## Current conclusion

- **Structural correspondence:** corresponding top-level sections 1–19 are present in both formats, including the workflow library, requirements catalog, quality/release gates, and reference/change governance.
- **Structural correspondence:** sections 1–19 are present in both formats, including sections 17–19; the earlier claim of a structural mismatch for those sections is withdrawn.
- **Exact textual parity:** not established.
- **Semantic parity:** not yet established.
- **Authority:** the owner-designated DOCX remains the source file; the Markdown must not silently supersede it solely because it is easier for agents to read.
- **Next action:** complete the section-by-section semantic review and record differences and resolutions before removing the OPEN status.

## Correction note — 2026-10-17

A full read of the 25-page owner Library DOCX through pages 22–25 and a direct enumeration of Markdown headings corrected several earlier conclusions in this crosswalk. Sections 17–19 and the numbered P0/P1 requirement catalogs are present in the DOCX; the earlier statements that they were absent are withdrawn. The remaining open work is semantic comparison, not proof of a structural omission. The DOCX section 15 execution stages (0–8) must also be distinguished from the separate section 18 quality gates (0–7).
## Requirement-catalog parity check — 2026-10-17

The original DOCX pages 22–23 were read directly, including the extracted requirement text. The DOCX section 17 contains the same P0-01–P0-22 and P1-01–P1-15 catalog and P2 policy found in the repository Markdown. Arabic requirement wording matches the inspected source text at the catalog level; Word's extraction reverses mixed RTL/LTR identifiers (e.g., visual P0-01 can be extracted as 01 0 - P). Therefore, the IDs are not Markdown-only additions. The catalog's presence is verified; this is not a certification that every other section, table, gate, or workflow is semantically identical.

A small editorial defect was confirmed in repository Markdown section 18: all eight gate-goal lines repeated الهدف: twice, while the source DOCX uses a single goal label. The eight duplicate labels were corrected in the Markdown mirror only, using the source DOCX as the authority; no requirement meaning or gate condition was changed. The source DOCX was not modified. The correction was committed as 656b0899579159d5454d0e4b6a7c53bc67f2d272. This is a controlled transcription correction, not a claim of complete semantic parity.
