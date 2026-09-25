-- Restore the tenant hierarchy columns before migrations that enforce tenant-scoped roles.
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  parent_tenant_id uuid references public.tenants(id) on delete restrict,
  name_ar text not null,
  name_en text,
  tenant_type text not null default 'sub_tenant',
  timezone text not null default 'Asia/Aden',
  status text not null default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint tenants_type_chk check (tenant_type in ('main_tenant','sub_tenant')),
  constraint tenants_status_chk check (status in ('active','suspended','archived'))
);
alter table public.tenants enable row level security;

alter table public.profiles add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.projects add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

create index if not exists profiles_tenant_id_idx on public.profiles(tenant_id);
create index if not exists projects_tenant_id_idx on public.projects(tenant_id);
create index if not exists tenants_parent_tenant_id_idx on public.tenants(parent_tenant_id);
