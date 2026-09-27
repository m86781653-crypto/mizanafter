-- Production invariant: a profile bound to a project must carry the same tenant as that project.
-- The composite FK prevents cross-tenant project/profile reassignment at the database boundary.

create unique index if not exists projects_id_tenant_uidx
  on public.projects (id, tenant_id);

alter table public.profiles
  drop constraint if exists profiles_project_tenant_fkey;

alter table public.profiles
  add constraint profiles_project_tenant_fkey
  foreign key (project_id, tenant_id)
  references public.projects (id, tenant_id)
  on delete set null;
