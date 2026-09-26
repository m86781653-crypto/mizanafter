create or replace function public.mizan_fault_to_work_order()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op='INSERT' and new.status not in ('resolved','closed') then
    insert into public.maintenance_work_orders(
      project_id,fault_id,asset_id,well_id,pump_id,type,priority,status,
      description,assigned_to,scheduled_date,notes
    )
    values(
      new.project_id,new.id,new.asset_id,new.well_id,new.pump_id,'corrective',
      case when new.severity='critical' then 'urgent'
           when new.severity='high' then 'high'
           else new.severity end,
      'open',
      coalesce('معالجة العطل ' || new.fault_number || ': ' || new.description,'معالجة عطل مسجل'),
      new.assigned_team,
      current_date,
      'تم إنشاء أمر العمل تلقائياً بواسطة ميزان AI من سجل العطل.'
    );
  end if;
  return new;
end;
$$;
revoke all on function public.mizan_fault_to_work_order() from public,anon,authenticated;
grant execute on function public.mizan_fault_to_work_order() to service_role;
drop trigger if exists mizan_fault_create_work_order on public.faults;
create trigger mizan_fault_create_work_order after insert on public.faults
for each row execute function public.mizan_fault_to_work_order();
