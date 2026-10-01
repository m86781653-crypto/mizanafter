-- Reached by isolated E2E after wells INSERT.
-- The pumps INSERT policy still called revoked public.is_super_admin().
drop policy if exists ins_pumps on public.pumps;
create policy ins_pumps on public.pumps
for insert to authenticated
with check (private.mizan_can_write_project(project_id,'pumps','insert'));
