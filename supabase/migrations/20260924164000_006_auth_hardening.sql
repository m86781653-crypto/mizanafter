-- MIZAN AI — authentication hardening
-- Prevents client-side privilege escalation through profiles and user metadata.

begin;

-- Profiles must default to a non-privileged role. Role/project assignment is administrative.
alter table public.profiles
  alter column role set default 'read_only';

-- Prevent a normal authenticated user from changing security-sensitive profile fields.
create or replace function public.protect_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and not public.is_super_admin() then
    if new.role is distinct from old.role
       or new.project_id is distinct from old.project_id
       or new.must_change_password is distinct from old.must_change_password then
      raise exception 'security-sensitive profile fields require administrative authorization';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_security_fields on public.profiles;
create trigger protect_profile_security_fields
before update on public.profiles
for each row execute function public.protect_profile_security_fields();

-- New auth users are always provisioned as read_only.
-- Administrative provisioning assigns the final role/project explicitly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, role, project_id, must_change_password
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', coalesce(new.email, 'User')),
    'read_only',
    null,
    true
  );
  return new;
end;
$$;

-- Project timezone is required for business-day rules; UTC remains a safe fallback
-- until each project is explicitly configured.
alter table public.projects
  add column if not exists timezone text not null default 'Asia/Aden';

-- Secure the project sequence counter table against cross-project access.
alter table if exists public.project_seq_counters enable row level security;

drop policy if exists "project_seq_select" on public.project_seq_counters;
drop policy if exists "project_seq_insert" on public.project_seq_counters;
drop policy if exists "project_seq_update" on public.project_seq_counters;

create policy "project_seq_select"
on public.project_seq_counters for select
to authenticated
using (
  public.is_super_admin()
  or project_id = public.get_user_project_id()
);

create policy "project_seq_insert"
on public.project_seq_counters for insert
to authenticated
with check (
  public.is_super_admin()
  or project_id = public.get_user_project_id()
);

create policy "project_seq_update"
on public.project_seq_counters for update
to authenticated
using (
  public.is_super_admin()
  or project_id = public.get_user_project_id()
)
with check (
  public.is_super_admin()
  or project_id = public.get_user_project_id()
);

commit;
