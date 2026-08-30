-- pre_topics ("נושאים שחשוב להכיר לפני הסשן") is community-wide prep, like
-- the syllabus — the free view carries it too.
create or replace view public.sessions_public as
select id,
  title,
  topic,
  scheduled_at,
  status,
  is_published,
  recording_id,
  canceled_at,
  open_to_all,
  syllabus_url,
  duration_minutes,
  created_at,
  updated_at,
  pre_topics
from public.sessions
where is_published and public.is_member();
