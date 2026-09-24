ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_project_id_fkey,
  DROP CONSTRAINT IF EXISTS audit_logs_actor_user_id_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT,
  ADD CONSTRAINT audit_logs_actor_user_id_fkey
    FOREIGN KEY (actor_user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
