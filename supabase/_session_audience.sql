-- ============================================================================
-- Open Code — who gets which session recording. Run once in the SQL Editor.
--
-- The rule the owner set:
--   * By default a session's recording belongs to PAYING members and to
--     mentors (and the team) — not to free members.
--   * An admin may mark a single session "open to the whole community", and
--     then every member gets it, free tier included.
--   * Losing the subscription removes access to sessions AND courses alike
--     (that part already works — queueRevokeAll on deactivation).
-- Safe to re-run.
-- ============================================================================

alter table public.sessions
  add column if not exists open_to_all boolean not null default false;

-- Drive links are paid material, EXCEPT the ones hanging off a session that
-- was opened to everyone. RLS is the real gate here — the UI only mirrors it.
drop policy if exists "content_links_select" on public.content_links;
create policy "content_links_select" on public.content_links for select to authenticated
  using (
    public.has_active_sub()
    or (
      public.is_member()
      and owner_type = 'session'
      and exists (
        select 1 from public.sessions s
        where s.id = public.content_links.owner_id and s.open_to_all
      )
    )
  );

-- The free-tier view carries the flag so the app can show "פתוח לכולן".
create or replace view public.sessions_public
with (security_invoker = false) as
  select id, title, topic, scheduled_at, status, is_published, recording_id,
         canceled_at, open_to_all, created_at, updated_at
  from public.sessions
  where is_published and public.is_member();

grant select on public.sessions_public to authenticated;
