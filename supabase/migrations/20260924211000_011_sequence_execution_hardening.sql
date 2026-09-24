/*
# MIZAN — sequence integrity hardening
Keeps the existing sequence system and closes direct client mutation.
*/
REVOKE ALL ON FUNCTION public.next_seq_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_seq_number(text) TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.seq_counters FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.project_seq_counters FROM authenticated;

COMMENT ON FUNCTION public.next_seq_number IS
  'Atomic server-side sequence generation. Client code must not mutate counters directly.';
