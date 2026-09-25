-- Internal sequence counters are accessed through privileged SECURITY DEFINER helpers.
-- They must never be directly writable/readable by authenticated clients.

revoke all on table public.seq_counters from anon, authenticated;
revoke all on table public.project_seq_counters from anon, authenticated;

drop policy if exists ins_seq on public.seq_counters;
drop policy if exists sel_seq on public.seq_counters;
drop policy if exists upd_seq on public.seq_counters;

drop policy if exists ins_proj_seq on public.project_seq_counters;
drop policy if exists sel_proj_seq on public.project_seq_counters;
drop policy if exists upd_proj_seq on public.project_seq_counters;
