-- Chat "waiting for my reply", round 2 (the owner, 22/10). The exact count on
-- production was 92 of 252 threads - most of them a member's "תודה" that needs
-- no answer. Two refinements, one source of truth in SQL:
--   is_chat_closer(body)      - a short closing word is not a question
--   chat_reply_dismissals     - "אין צורך במענה" per thread, per reader; a
--                               newer message from the other side reopens it
create or replace function public.is_chat_closer(p_body text)
returns boolean
language sql
immutable
set search_path = public
as $$
  with t as (
    select trim(regexp_replace(coalesce(p_body, ''), '<[^>]+>', ' ', 'g')) as txt
  )
  select coalesce((
    select position('?' in txt) = 0
      and (
        txt ~ '^(תודה|מעולה|סבבה|אוקי|בסדר|מצוי|יופי|מושלם|בשמחה|אין בעד מה|לילה טוב|שבת שלום|שבוע טוב|בהצלחה|מקסים|איזה כיף|כיף|נהדר|מגניב|וואו|אחלה|💜|❤|🙏|👍|😊|🥰)'
        or (
          length(txt) <= 12
          and txt !~ '^(מתי|איך|מה|למה|האם|איפה|כמה|מי |אפשר|אולי|אשמח|צריכ|רציתי|יש |אין |תוכלי|תוכל|אפשרי|נ?שלח|בבקשה)'
        )
      )
    from t
  ), false);
$$;

create table if not exists public.chat_reply_dismissals (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
alter table public.chat_reply_dismissals enable row level security;
drop policy if exists "own dismissals" on public.chat_reply_dismissals;
create policy "own dismissals" on public.chat_reply_dismissals
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
grant select, insert, update, delete on public.chat_reply_dismissals to authenticated;
grant all on public.chat_reply_dismissals to service_role;

-- "אין צורך במענה" / undo, by a participant only
create or replace function public.set_reply_dismissed(p_conversation uuid, p_dismissed boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation and (c.a_id = auth.uid() or c.b_id = auth.uid())
  ) then
    raise exception 'not a participant';
  end if;
  if p_dismissed then
    insert into public.chat_reply_dismissals (conversation_id, profile_id, dismissed_at)
    values (p_conversation, auth.uid(), now())
    on conflict (conversation_id, profile_id) do update set dismissed_at = now();
  else
    delete from public.chat_reply_dismissals
    where conversation_id = p_conversation and profile_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.set_reply_dismissed(uuid, boolean) from public;
grant execute on function public.set_reply_dismissed(uuid, boolean) to authenticated;

-- the last message of each thread now says whether it is a closer / dismissed
drop function if exists public.conversation_last_messages(uuid[]);
create function public.conversation_last_messages(p_ids uuid[])
returns table (conversation_id uuid, sender_id uuid, body text, created_at timestamptz, closer boolean, dismissed boolean)
language sql
stable
security invoker
set search_path = public
as $$
  select l.conversation_id, l.sender_id, l.body, l.created_at,
         public.is_chat_closer(l.body) as closer,
         (d.dismissed_at is not null and d.dismissed_at >= l.created_at) as dismissed
  from (
    select distinct on (m.conversation_id) m.conversation_id, m.sender_id, m.body, m.created_at
    from public.messages m
    where m.conversation_id = any(p_ids)
    order by m.conversation_id, m.created_at desc
  ) l
  left join public.chat_reply_dismissals d
    on d.conversation_id = l.conversation_id and d.profile_id = auth.uid();
$$;
grant execute on function public.conversation_last_messages(uuid[]) to authenticated, service_role;

create or replace function public.unanswered_conversation_count(p_profile uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from (
    select distinct on (m.conversation_id) m.conversation_id, m.sender_id, m.body, m.created_at
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.a_id = p_profile or c.b_id = p_profile
    order by m.conversation_id, m.created_at desc
  ) last
  left join public.chat_reply_dismissals d
    on d.conversation_id = last.conversation_id and d.profile_id = p_profile
  where last.sender_id <> p_profile
    and not public.is_chat_closer(last.body)
    and (d.dismissed_at is null or d.dismissed_at < last.created_at);
$$;
