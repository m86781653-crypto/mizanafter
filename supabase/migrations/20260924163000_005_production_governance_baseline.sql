-- MIZAN AI production governance baseline
-- Scope: water-service operations, automated financial controls, tenant/project isolation.
-- This migration intentionally does not introduce generic ERP accounting.

begin;

-- Normalize the role vocabulary: accountants are not an operational role in MIZAN.
-- Existing accountant memberships are converted to project_manager for controlled financial approval.
update public.profiles
set role = 'project_manager'
where role = 'accountant';

-- Prevent users from self-promoting or moving themselves between projects.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- Project managers are the controlled financial approvers; they must not approve their own request.
create table if not exists public.financial_approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  action_type text not null check (action_type in ('invoice_cancel','invoice_adjust','payment_reversal','tariff_change','period_close')),
  target_id uuid,
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint financial_approval_not_self_approved
    check (approved_by is null or approved_by <> requested_by)
);

create index if not exists idx_financial_approvals_project_status
  on public.financial_approvals(project_id, status);

alter table public.financial_approvals enable row level security;

drop policy if exists "financial approvals project access" on public.financial_approvals;
create policy "financial approvals project access"
on public.financial_approvals for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.project_id = financial_approvals.project_id
      and p.role in ('project_manager','read_only')
  )
);

-- Meter readings: server-enforced business date and idempotency.
alter table public.meter_readings
  add column if not exists business_date date,
  add column if not exists idempotency_key text,
  add column if not exists captured_at timestamptz,
  add column if not exists device_id text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists exception_code text;

update public.meter_readings
set business_date = coalesce(business_date, reading_date::date),
    captured_at = coalesce(captured_at, reading_date)
where business_date is null or captured_at is null;

alter table public.meter_readings
  alter column business_date set not null;

create unique index if not exists uq_meter_reading_idempotency
  on public.meter_readings(project_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists uq_meter_reading_meter_business_day
  on public.meter_readings(project_id, meter_id, business_date)
  where status = 'approved';

-- Approved readings become immutable through the client-facing RLS path.
drop policy if exists "Project users can update readings" on public.meter_readings;
create policy "Project users can update pending readings"
on public.meter_readings for update
to authenticated
using (
  status <> 'approved'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.project_id = meter_readings.project_id
      and p.role in ('meter_reader','project_manager')
  )
)
with check (
  status <> 'approved'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.project_id = meter_readings.project_id
      and p.role in ('meter_reader','project_manager')
  )
);

-- Payments are append-only from the operational UI.
drop policy if exists "Project users can delete payments" on public.payments;

-- Financial transaction ledger for water-service financial events.
create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('invoice','payment','adjustment','reversal')),
  source_id uuid not null,
  amount numeric(14,2) not null,
  transaction_date timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(project_id, transaction_type, source_id)
);

create index if not exists idx_financial_transactions_project_date
  on public.financial_transactions(project_id, transaction_date);

alter table public.financial_transactions enable row level security;

drop policy if exists "financial transactions project read" on public.financial_transactions;
create policy "financial transactions project read"
on public.financial_transactions for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.project_id = financial_transactions.project_id
      and p.role in ('project_manager','collector','read_only')
  )
);

-- No direct client insert/update/delete policy is intentionally created.
-- Ledger writes must be performed by trusted server-side functions/triggers.

commit;
