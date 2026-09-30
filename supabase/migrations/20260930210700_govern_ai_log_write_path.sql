-- Restore the documented AI audit write path without granting direct table INSERT.
create or replace function public.mizan_log_ai_interaction(
  p_project_id uuid,
  p_question text,
  p_answer text,
  p_model text,
  p_success boolean default true,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode='42501';
  end if;

  if p_project_id is null or not private.mizan_can_access_project(p_project_id) then
    raise exception 'AI_LOG_PROJECT_FORBIDDEN' using errcode='42501';
  end if;

  if nullif(trim(coalesce(p_question,'')),'') is null then
    raise exception 'AI_LOG_QUESTION_REQUIRED' using errcode='22023';
  end if;

  if nullif(trim(coalesce(p_answer,'')),'') is null then
    raise exception 'AI_LOG_ANSWER_REQUIRED' using errcode='22023';
  end if;

  insert into public.ai_logs(
    operation, model, input_summary, output_summary, confidence,
    duration_ms, success, error_message, user_id, project_id
  )
  values(
    'mizan_copilot',
    nullif(trim(coalesce(p_model,'')),''),
    left(trim(p_question),500),
    left(trim(p_answer),1000),
    null,
    null,
    coalesce(p_success,true),
    nullif(trim(coalesce(p_error_message,'')),''),
    auth.uid(),
    p_project_id
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.mizan_log_ai_interaction(uuid,text,text,text,boolean,text) from public,anon;
grant execute on function public.mizan_log_ai_interaction(uuid,text,text,text,boolean,text) to authenticated;
