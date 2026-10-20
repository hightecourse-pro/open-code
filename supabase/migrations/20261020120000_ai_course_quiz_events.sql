-- AI course quiz (20/10, second round): the owner hit the error boundary after
-- the second question on her own browser while the automated run passed - so
-- the page now reports every client-side failure here (window errors,
-- unhandled rejections, the error boundary) with the step and the browser,
-- and the Hightecourse admin shows the latest ones. Admin-only under RLS;
-- writes come from the server (service role) via /api/ai-course/report.
create table if not exists public.ai_course_quiz_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('client_error', 'boundary', 'api_error')),
  submission_id uuid references public.ai_course_quiz_submissions(id) on delete set null,
  step text,
  message text,
  digest text,
  stack text,
  user_agent text,
  href text,
  created_at timestamptz not null default now()
);
create index if not exists ai_course_quiz_events_created_idx
  on public.ai_course_quiz_events (created_at desc);

alter table public.ai_course_quiz_events enable row level security;
create policy "ai_course_quiz_events_admin" on public.ai_course_quiz_events
  for all using (public.is_admin()) with check (public.is_admin());
