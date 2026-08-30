-- Course feedback stopped depending on an enrollment row (2026-08-30): an
-- admin trying the course, or a member with a personally-gifted course, has
-- no enrollments row — her rating/feedback UPDATE matched nothing and
-- vanished silently ("המשוב על הקורסים לא עובד"). Feedback now always lands
-- here; enrollments keeps its copy when the row exists.
create table if not exists public.course_feedback (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  rating integer check (rating between 1 and 5),
  feedback text,
  updated_at timestamptz not null default now(),
  primary key (profile_id, course_id)
);
alter table public.course_feedback enable row level security;
drop policy if exists course_feedback_owner on public.course_feedback;
create policy course_feedback_owner on public.course_feedback
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- Backfill from what enrollments already holds, so the two sources agree.
insert into public.course_feedback (profile_id, course_id, rating, feedback)
select profile_id, course_id, rating, feedback
from public.enrollments
where rating is not null or feedback is not null
on conflict (profile_id, course_id) do nothing;
