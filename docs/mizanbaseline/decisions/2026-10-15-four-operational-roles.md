# Owner Decision — Four Operational Roles per Child Water Project

- **Decision date:** 2026-10-15
- **Decision owner:** MIZAN product owner
- **Status:** Explicitly approved in the project conversation; repository record created for traceability.
- **Supersedes:** Any earlier documentation statement that a child water project has exactly three operational roles.
- **Scope:** Documentation and future authorization/provisioning acceptance criteria. This record does not authorize immediate production changes.

## Decision
Every child water-project tenant must have exactly these four operational roles:

1. `project_manager` — مدير المشروع
2. `meter_reader` — قارئ العدادات
3. `collection_officer` — المحصل
4. `operations_maintenance` — مسؤول التشغيل والصيانة

The Operations & Maintenance role is a distinct operational role, not an informal responsibility folded into Project Manager.

## Boundaries
- Platform Administrator remains a technical platform role and is not counted among the four project-operational roles.
- Central Governance remains a separate oversight scope and is not counted as a child-project operational role.
- Role provisioning must not be implemented until existing role constraints, database authorization, RLS/RPCs, UI visibility, and tests have been inspected and aligned.
- This decision changes the target documentation model; it does not prove the current application or production database already supports it.
