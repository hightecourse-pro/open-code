-- Chat (the owner, 22/10): "8 ממתינות למענה ואני לא מוצאת אותן". The list
-- counted "awaiting my reply" from a window of the newest 150 messages across
-- all threads - partial for a team member with ~190 conversations, and with
-- no way to see WHICH threads. Two helpers:
--   conversation_last_messages(ids)  - the true last message of each thread
--                                      (one row per conversation; RLS applies)
--   unanswered_conversation_count(p) - how many of her threads end with the
--                                      other side's word (for the sidebar badge)
create or replace function public.conversation_last_messages(p_ids uuid[])
returns table (conversation_id uuid, sender_id uuid, body text, created_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (m.conversation_id) m.conversation_id, m.sender_id, m.body, m.created_at
  from public.messages m
  where m.conversation_id = any(p_ids)
  order by m.conversation_id, m.created_at desc;
$$;

create or replace function public.unanswered_conversation_count(p_profile uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from (
    select distinct on (m.conversation_id) m.conversation_id, m.sender_id
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.a_id = p_profile or c.b_id = p_profile
    order by m.conversation_id, m.created_at desc
  ) last
  where last.sender_id <> p_profile;
$$;

revoke all on function public.unanswered_conversation_count(uuid) from public;
grant execute on function public.unanswered_conversation_count(uuid) to service_role;
grant execute on function public.conversation_last_messages(uuid[]) to authenticated, service_role;
