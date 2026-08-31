-- ============================================================================
-- Answering the TEAM in chat is never behind a paywall (the owner, 1/9: the
-- personal note tells her "ענו לי בצ'אט" — a pending member must be able to).
-- The insert policy gains one branch: the conversation's other side is an
-- admin. Everything else still requires an active subscription; the app layer
-- keeps the finer recipient rules. Safe to re-run.
-- ============================================================================

alter policy "messages_insert" on public.messages
  with check (
    (sender_id = (select auth.uid()))
    and (exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.a_id, c.b_id)
    ))
    and (
      (select public.has_active_sub())
      or exists (
        select 1
        from public.conversations c
        join public.profiles p
          on p.id = case when c.a_id = (select auth.uid()) then c.b_id else c.a_id end
        where c.id = messages.conversation_id
          and p.role = 'admin'
      )
    )
  );
