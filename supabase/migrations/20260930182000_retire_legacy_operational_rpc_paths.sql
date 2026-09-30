-- Retire legacy operational RPCs replaced by governed lifecycle and arbitrary-period reporting.
revoke execute on function public.mizan_report_fault(uuid,text,text,text,uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.mizan_update_fault_status(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.mizan_update_work_order_status(uuid,text,text) from public,anon,authenticated;
revoke execute on function public.mizan_monthly_maintenance_report(uuid,date) from public,anon,authenticated;
