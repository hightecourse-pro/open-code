-- Chat stars (the owner, 30/10): an admin marks a thread she must come back to
-- (״לחזור אליה״) and can list only those. Admins only - a member never sees or
-- sets a star. Stored on the conversation itself: a thread is 1:1 and only its
-- two participants can read it, so the star is seen by exactly the admin who
-- owns that thread (and by a second admin only in her own threads with her).
alter table public.conversations
  add column if not exists starred_at timestamptz,
  add column if not exists starred_by uuid references public.profiles(id) on delete set null;

create or replace function public.set_chat_star(p_conversation uuid, p_starred boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'admins only';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation and (c.a_id = auth.uid() or c.b_id = auth.uid())
  ) then
    raise exception 'not a participant';
  end if;
  update public.conversations
  set starred_at = case when p_starred then now() else null end,
      starred_by = case when p_starred then auth.uid() else null end
  where id = p_conversation;
end;
$$;
revoke all on function public.set_chat_star(uuid, boolean) from public;
grant execute on function public.set_chat_star(uuid, boolean) to authenticated;
