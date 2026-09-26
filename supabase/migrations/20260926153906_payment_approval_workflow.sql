-- Payment approval workflow: collector records -> project manager reviews.
-- The existing payments table and mizan_record_payment() remain the source of truth;
-- this migration adds the missing controlled approval state without creating a second payment system.

begin;

alter table public.payments
  add column if not exists approval_status text not null default 'pending',
  add column if not exists recorded_by uuid references auth.users(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id),
  add column if not exists rejected_at timestamptz,
  add column if not exists approval_reason text;

alter table public.payments
  drop constraint if exists payments_approval_status_check;

alter table public.payments
  add constraint payments_approval_status_check
  check (approval_status in ('pending','approved','rejected'));

create index if not exists idx_payments_project_approval_status
  on public.payments(project_id, approval_status);

create index if not exists idx_payments_recorded_by
  on public.payments(recorded_by);

create index if not exists idx_payments_approved_by
  on public.payments(approved_by);

-- No existing production payment rows were found during the preflight audit.
-- Keep this defensive backfill for environments that already contain legacy payments.
update public.payments
set approval_status = 'approved',
    approved_at = coalesce(approved_at, payment_date)
where approval_status = 'pending'
  and recorded_by is null
  and approved_by is null
  and rejected_by is null;

insert into public.mizan_role_permissions(role_code, permission_code)
values
  ('tenant_manager', 'collection.approve'),
  ('platform_admin', 'collection.approve')
on conflict do nothing;

create or replace function public.mizan_record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_reference_number text default null,
  p_notes text default null
) returns public.payments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  inv public.invoices%rowtype;
  pay public.payments%rowtype;
  pending_amount numeric;
  available_balance numeric;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into inv
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  if not private.mizan_has_permission('collection.record')
     or not private.mizan_can_write_project(inv.project_id, 'payments', 'insert')
  then
    raise exception 'COLLECTION_FORBIDDEN';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  if p_reference_number is not null then
    select * into pay
    from public.payments
    where project_id = inv.project_id
      and reference_number = p_reference_number
    limit 1;

    if found then
      return pay;
    end if;
  end if;

  select coalesce(sum(p.amount), 0)
  into pending_amount
  from public.payments p
  where p.invoice_id = inv.id
    and p.approval_status = 'pending';

  available_balance := greatest(
    coalesce(inv.grand_total, 0)
    - coalesce(inv.amount_paid, 0)
    - pending_amount,
    0
  );

  if p_amount > available_balance then
    raise exception 'PAYMENT_EXCEEDS_AVAILABLE_BALANCE';
  end if;

  insert into public.payments(
    project_id,
    invoice_id,
    customer_id,
    receipt_number,
    amount,
    payment_method,
    collector_name,
    reference_number,
    notes,
    approval_status,
    recorded_by
  )
  values (
    inv.project_id,
    inv.id,
    inv.customer_id,
    public.next_seq_number('RCP'),
    p_amount,
    coalesce(nullif(p_payment_method, ''), 'cash'),
    null,
    p_reference_number,
    p_notes,
    'pending',
    (select auth.uid())
  )
  returning * into pay;

  insert into public.audit_logs(
    table_name,
    record_id,
    action,
    user_id,
    actor_user_id,
    project_id,
    entity_type,
    entity_id,
    reason,
    result,
    before_data,
    after_data
  )
  values (
    'payments',
    pay.id,
    'PAYMENT_RECORDED',
    (select auth.uid()),
    (select auth.uid()),
    inv.project_id,
    'payment',
    pay.id,
    p_notes,
    'pending_approval',
    jsonb_build_object(
      'invoice_id', inv.id,
      'balance', inv.balance
    ),
    jsonb_build_object(
      'amount', pay.amount,
      'receipt_number', pay.receipt_number,
      'approval_status', pay.approval_status,
      'recorded_by', pay.recorded_by
    )
  );

  return pay;

exception when unique_violation then
  if p_reference_number is not null then
    select * into pay
    from public.payments
    where project_id = inv.project_id
      and reference_number = p_reference_number
    limit 1;

    if found then
      return pay;
    end if;
  end if;
  raise;
end;
$function$;

create or replace function public.mizan_review_payment(
  p_payment_id uuid,
  p_decision text,
  p_reason text default null
) returns public.payments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  pay public.payments%rowtype;
  inv public.invoices%rowtype;
  new_paid numeric;
  new_balance numeric;
  new_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if lower(coalesce(p_decision, '')) not in ('approved', 'rejected') then
    raise exception 'INVALID_PAYMENT_DECISION';
  end if;

  if lower(p_decision) = 'rejected'
     and nullif(trim(coalesce(p_reason, '')), '') is null
  then
    raise exception 'REJECTION_REASON_REQUIRED';
  end if;

  select * into pay
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  if not private.mizan_has_permission('collection.approve')
     or not private.mizan_can_write_project(pay.project_id, 'payments', 'update')
  then
    raise exception 'PAYMENT_APPROVAL_FORBIDDEN';
  end if;

  if pay.recorded_by = (select auth.uid()) then
    raise exception 'PAYMENT_SELF_APPROVAL_FORBIDDEN';
  end if;

  if pay.approval_status <> 'pending' then
    raise exception 'PAYMENT_ALREADY_REVIEWED';
  end if;

  if lower(p_decision) = 'rejected' then
    update public.payments
    set approval_status = 'rejected',
        rejected_by = (select auth.uid()),
        rejected_at = now(),
        approval_reason = nullif(trim(coalesce(p_reason, '')), '')
    where id = pay.id
    returning * into pay;

    insert into public.audit_logs(
      table_name, record_id, action, user_id, actor_user_id, project_id,
      entity_type, entity_id, reason, result, before_data, after_data
    )
    values (
      'payments', pay.id, 'PAYMENT_REJECTED',
      (select auth.uid()), (select auth.uid()), pay.project_id,
      'payment', pay.id, pay.approval_reason, 'rejected',
      jsonb_build_object('approval_status', 'pending'),
      jsonb_build_object(
        'approval_status', pay.approval_status,
        'rejected_by', pay.rejected_by,
        'rejected_at', pay.rejected_at
      )
    );

    return pay;
  end if;

  select * into inv
  from public.invoices
  where id = pay.invoice_id
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  if pay.amount > coalesce(inv.balance, 0) then
    raise exception 'PAYMENT_BALANCE_CHANGED';
  end if;

  new_paid := coalesce(inv.amount_paid, 0) + pay.amount;
  new_balance := greatest(coalesce(inv.grand_total, 0) - new_paid, 0);
  new_status := case when new_balance = 0 then 'paid' else 'partial' end;

  update public.payments
  set approval_status = 'approved',
      approved_by = (select auth.uid()),
      approved_at = now(),
      approval_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = pay.id
  returning * into pay;

  update public.invoices
  set amount_paid = new_paid,
      balance = new_balance,
      status = new_status,
      updated_at = now()
  where id = inv.id;

  insert into public.audit_logs(
    table_name, record_id, action, user_id, actor_user_id, project_id,
    entity_type, entity_id, reason, result, before_data, after_data
  )
  values (
    'payments', pay.id, 'PAYMENT_APPROVED',
    (select auth.uid()), (select auth.uid()), pay.project_id,
    'payment', pay.id, pay.approval_reason, 'approved',
    jsonb_build_object(
      'approval_status', 'pending',
      'invoice_amount_paid', inv.amount_paid,
      'invoice_balance', inv.balance
    ),
    jsonb_build_object(
      'approval_status', pay.approval_status,
      'approved_by', pay.approved_by,
      'approved_at', pay.approved_at,
      'invoice_amount_paid', new_paid,
      'invoice_balance', new_balance
    )
  );

  return pay;
end;
$function$;

-- Direct client-side mutations would bypass the workflow. Reads remain available;
-- recording and review happen through controlled RPCs.
revoke insert, update, delete on table public.payments from anon, authenticated;

revoke execute on function public.mizan_record_payment(uuid,numeric,text,text,text)
  from public, anon;
revoke execute on function public.mizan_review_payment(uuid,text,text)
  from public, anon;

grant execute on function public.mizan_record_payment(uuid,numeric,text,text,text)
  to authenticated, service_role;
grant execute on function public.mizan_review_payment(uuid,text,text)
  to authenticated, service_role;

commit;
