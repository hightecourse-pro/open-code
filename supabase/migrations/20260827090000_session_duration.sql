-- PM round (admin system, 2026-08-27): each session carries its planned
-- duration, shown in the admin list and on the community events screen.
alter table public.sessions add column if not exists duration_minutes int;

-- The free-tier view names its columns — expose the duration there too.
drop view if exists public.sessions_public;
create view public.sessions_public
with (security_invoker = false) as
  select id, title, topic, scheduled_at, status, is_published, recording_id,
         canceled_at, open_to_all, syllabus_url, duration_minutes, created_at, updated_at
  from public.sessions
  where is_published and public.is_member();

grant select on public.sessions_public to authenticated;
