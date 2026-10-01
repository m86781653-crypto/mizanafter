-- Payment recording must serialize concurrent attempts without requiring invoice UPDATE privileges.
-- Collection officers can INSERT payments only through the governed RPC.
create or replace function public.mizan_record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text default 'cash',
  p_reference_number text default null,
  p_notes text default null,
  p_client_payment_id uuid default null
)
returns public.payments
language plpgsql
security definer
set search_path=''
as $function$
declare
  inv public.invoices%rowtype;
  pay public.payments%rowtype;
  pending_amount numeric;
  available_balance numeric;
  v_collector_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('mizan:payment-invoice:' || p_invoice_id::text, 0)
  );

  select * into inv
  from public.invoices
  where id = p_invoice_id;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  if not private.mizan_has_permission('collection.record')
     or not private.mizan_can_write_project(inv.project_id,'payments','insert')
  then
    raise exception 'COLLECTION_FORBIDDEN';
  end if;

  if p_amount is null or p_amount<=0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  if p_client_payment_id is not null then
    select * into pay
    from public.payments
    where client_payment_id=p_client_payment_id
    limit 1;
    if found then return pay; end if;
  end if;

  if p_reference_number is not null then
    select * into pay
    from public.payments
    where project_id=inv.project_id
      and reference_number=p_reference_number
    limit 1;
    if found then return pay; end if;
  end if;

  select coalesce(sum(p.amount),0)
    into pending_amount
  from public.payments p
  where p.invoice_id=inv.id
    and p.approval_status='pending';

  available_balance:=greatest(
    coalesce(inv.grand_total,0)-coalesce(inv.amount_paid,0)-pending_amount,
    0
  );

  if p_amount>available_balance then
    raise exception 'PAYMENT_EXCEEDS_AVAILABLE_BALANCE';
  end if;

  select p.full_name into v_collector_name
  from public.profiles p
  where p.id=(select auth.uid());

  insert into public.payments(
    project_id,invoice_id,customer_id,receipt_number,amount,payment_method,
    collector_name,reference_number,notes,approval_status,recorded_by,client_payment_id
  )
  values(
    inv.project_id,inv.id,inv.customer_id,public.next_seq_number('RCP'),
    p_amount,coalesce(nullif(p_payment_method,''),'cash'),v_collector_name,
    p_reference_number,p_notes,'pending',(select auth.uid()),p_client_payment_id
  )
  returning * into pay;

  insert into public.audit_logs(
    table_name,record_id,action,user_id,actor_user_id,project_id,
    entity_type,entity_id,reason,result,before_data,after_data
  )
  values(
    'payments',pay.id,'PAYMENT_RECORDED',(select auth.uid()),(select auth.uid()),
    inv.project_id,'payment',pay.id,p_notes,'pending_approval',
    jsonb_build_object('invoice_id',inv.id,'balance',inv.balance),
    jsonb_build_object(
      'amount',pay.amount,
      'receipt_number',pay.receipt_number,
      'approval_status',pay.approval_status,
      'recorded_by',pay.recorded_by,
      'collector_name',pay.collector_name,
      'client_payment_id',pay.client_payment_id
    )
  );

  return pay;

exception when unique_violation then
  if p_client_payment_id is not null then
    select * into pay
    from public.payments
    where client_payment_id=p_client_payment_id
    limit 1;
    if found then return pay; end if;
  end if;

  if p_reference_number is not null then
    select * into pay
    from public.payments
    where project_id=inv.project_id
      and reference_number=p_reference_number
    limit 1;
    if found then return pay; end if;
  end if;

  raise;
end;
$function$;

revoke all on function public.mizan_record_payment(uuid,numeric,text,text,text,uuid) from public,anon;
grant execute on function public.mizan_record_payment(uuid,numeric,text,text,text,uuid) to authenticated;
