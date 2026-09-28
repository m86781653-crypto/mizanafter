alter table public.maintenance_work_orders
  add column if not exists memo_version integer not null default 1,
  add column if not exists memo_issued_at timestamptz,
  add column if not exists memo_issued_by uuid references auth.users(id);

create or replace function public.mizan_mark_work_order_memo_issued(p_work_order_id uuid)
returns public.maintenance_work_orders
language plpgsql
security definer
set search_path = ''
as $$
declare v_wo public.maintenance_work_orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_wo from public.maintenance_work_orders where id=p_work_order_id for update;
  if v_wo.id is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if not private.mizan_can_write_project(v_wo.project_id,'maintenance_work_orders','update') then raise exception 'WORK_ORDER_UPDATE_FORBIDDEN'; end if;
  update public.maintenance_work_orders set memo_issued_at=now(),memo_issued_by=auth.uid(),memo_version=coalesce(memo_version,1)
  where id=p_work_order_id returning * into v_wo;
  perform private.mizan_write_audit(v_wo.project_id,'MAINTENANCE_MEMO_ISSUED','maintenance_work_order',v_wo.id,null,jsonb_build_object('work_order_number',v_wo.work_order_number,'memo_version',v_wo.memo_version),null,'success');
  return v_wo;
end; $$;

revoke all on function public.mizan_mark_work_order_memo_issued(uuid) from public,anon,authenticated;
grant execute on function public.mizan_mark_work_order_memo_issued(uuid) to authenticated;