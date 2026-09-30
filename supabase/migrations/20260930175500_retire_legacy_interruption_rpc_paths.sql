-- Retire legacy interruption RPCs that allowed direct interruption creation/status manipulation.
revoke execute on function public.mizan_report_service_interruption(uuid,text,text,text,text,text,timestamptz,integer,numeric) from public,anon,authenticated;
revoke execute on function public.mizan_update_service_interruption_status(uuid,text,text) from public,anon,authenticated;
