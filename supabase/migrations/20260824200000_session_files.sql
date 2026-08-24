-- Session handouts (PM round): a syllabus and a materials link per session,
-- pasted by the admin in ניהול תכנים and offered to members on the events and
-- recordings screens. Plain URLs — Drive, the app's own /public, anywhere.
alter table public.sessions add column if not exists syllabus_url text;
alter table public.sessions add column if not exists materials_url text;

-- The free-tier view names its columns, so the syllabus must be added by
-- hand. Deliberately syllabus only: the materials, like the zoom link, are a
-- subscriber's — a free member sees what a session is about, not its content.
drop view if exists public.sessions_public;
create view public.sessions_public
with (security_invoker = false) as
  select id, title, topic, scheduled_at, status, is_published, recording_id,
         canceled_at, open_to_all, syllabus_url, created_at, updated_at
  from public.sessions
  where is_published and public.is_member();

grant select on public.sessions_public to authenticated;
