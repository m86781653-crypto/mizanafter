-- Reached by isolated E2E after customer SELECT.
-- The wells INSERT policy still called revoked public.is_super_admin().
-- Preserve the existing role/resource write boundary through the current kernel.
drop policy if exists ins_wells on public.wells;
create policy ins_wells on public.wells
for insert to authenticated
with check (private.mizan_can_write_project(project_id,'wells','insert'));
