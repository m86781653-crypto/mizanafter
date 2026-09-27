create or replace function private.mizan_clear_must_change_password(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'UNAUTHORIZED';
  end if;

  update public.profiles
     set must_change_password = false
   where id = p_user_id;
end;
$$;

revoke all on function private.mizan_clear_must_change_password(uuid) from public;
grant execute on function private.mizan_clear_must_change_password(uuid) to authenticated;

create or replace function public.mizan_complete_password_change()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.mizan_clear_must_change_password(auth.uid());
$$;

revoke all on function public.mizan_complete_password_change() from public;
grant execute on function public.mizan_complete_password_change() to authenticated;
