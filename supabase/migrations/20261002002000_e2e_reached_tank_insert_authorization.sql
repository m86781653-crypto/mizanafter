-- Reached by isolated E2E after pump INSERT.
-- The tanks INSERT policy still called retired public.is_super_admin().
drop policy if exists ins_tanks on public.tanks;
create policy ins_tanks on public.tanks
for insert to authenticated
with check (private.mizan_can_write_project(project_id,'tanks','insert'));
