/* MIZAN — sequence execution hardening */
REVOKE ALL ON FUNCTION public.next_seq_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_seq_number(text) TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.seq_counters FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.project_seq_counters FROM authenticated;
COMMENT ON TABLE public.seq_counters IS 'Server-owned sequence counters; direct client mutation is forbidden.';
COMMENT ON TABLE public.project_seq_counters IS 'Server-owned project sequence counters; direct client mutation is forbidden.';
