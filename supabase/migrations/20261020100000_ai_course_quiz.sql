-- AI course quiz (the owner, 20/10): a public Hightecourse-branded page where a
-- developer answers a few friendly questions and gets matched to one of the two
-- "Advanced GenAI & Agentic AI for Developers" tracks - the very-advanced one
-- (no drills, fast pace) or the foundations one (from basics, with practice).
-- One row per email; created at the details step and updated as she answers, so
-- the team sees mid-form abandonment too. All access is server-side (service
-- role) - RLS leaves only admins able to read from the client.
create table if not exists public.ai_course_quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text not null,
  last_name text not null,
  -- "רשומה לקורס" / "מתכוונת להירשם בהקדם"
  signup_status text not null check (signup_status in ('registered', 'planning')),
  -- {q1: 0|1|2, ...} as she answers; questions_done tracks how far she got.
  answers jsonb not null default '{}'::jsonb,
  questions_done int not null default 0,
  score int,
  recommendation text check (recommendation in ('advanced', 'foundations')),
  -- "האם את באמת מעוניינת שנשבץ אותך בקורס זה": null until she answers.
  wants_placement boolean,
  downloaded_syllabus boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A re-take with the same address updates her row instead of duplicating.
create unique index if not exists ai_course_quiz_submissions_email_key
  on public.ai_course_quiz_submissions (lower(email));
create index if not exists ai_course_quiz_submissions_created_idx
  on public.ai_course_quiz_submissions (created_at desc);

alter table public.ai_course_quiz_submissions enable row level security;
create policy "ai_course_quiz_admin" on public.ai_course_quiz_submissions
  for all using (public.is_admin()) with check (public.is_admin());
