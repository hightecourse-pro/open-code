-- ============================================================================
-- Open Code — Phase 3 (AI tools): CV reviews + interview simulator
-- ============================================================================

create type public.cv_source as enum ('ai', 'mentor');
create type public.interview_agent as enum ('hr', 'tech', 'friendly');
create type public.interview_difficulty as enum ('basic', 'standard', 'hard');
create type public.interview_status as enum ('live', 'done');
create type public.turn_role as enum ('agent', 'candidate');

-- ---------------------------------------------------------------- CV reviews
create table public.cv_reviews (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  source      public.cv_source not null default 'ai',
  reviewer_id uuid references public.profiles (id) on delete set null,
  language    text not null default 'he',
  score       int,
  summary     text,
  insights    jsonb not null default '[]'::jsonb,  -- [{type, title, detail}]
  job_fit     jsonb,                               -- {score, matched[], missing[]}
  cv_text     text,
  created_at  timestamptz not null default now()
);
create index cv_reviews_profile_idx on public.cv_reviews (profile_id, created_at desc);

-- ---------------------------------------------------------------- interviews
create table public.interview_sessions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  agent       public.interview_agent not null default 'hr',
  tech_tags   text[] not null default '{}',
  difficulty  public.interview_difficulty not null default 'standard',
  status      public.interview_status not null default 'live',
  created_at  timestamptz not null default now(),
  ended_at    timestamptz
);
create index interview_sessions_profile_idx on public.interview_sessions (profile_id, created_at desc);

create table public.interview_turns (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.interview_sessions (id) on delete cascade,
  role        public.turn_role not null,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index interview_turns_session_idx on public.interview_turns (session_id, created_at);

create table public.interview_feedback (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null unique references public.interview_sessions (id) on delete cascade,
  overall_score int,
  summary      text,
  strengths    jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

-- helper: does the current user own this interview session?
create or replace function public.owns_interview(sess uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.interview_sessions s
    where s.id = sess and s.profile_id = (select auth.uid())
  );
$$;

-- ============================================================================
-- RLS — all owner-scoped (mentors can read a CV review only when assigned)
-- ============================================================================
alter table public.cv_reviews enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_turns enable row level security;
alter table public.interview_feedback enable row level security;

create policy "cv_reviews_select" on public.cv_reviews for select to authenticated
  using (profile_id = (select auth.uid()) or reviewer_id = (select auth.uid()) or public.is_admin());
create policy "cv_reviews_insert_own" on public.cv_reviews for insert to authenticated
  with check (profile_id = (select auth.uid()) and public.has_active_sub());

create policy "interview_sessions_own" on public.interview_sessions for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()) and public.has_active_sub());

create policy "interview_turns_select" on public.interview_turns for select to authenticated
  using (public.owns_interview(session_id));
create policy "interview_turns_insert" on public.interview_turns for insert to authenticated
  with check (public.owns_interview(session_id));

create policy "interview_feedback_select" on public.interview_feedback for select to authenticated
  using (public.owns_interview(session_id));
create policy "interview_feedback_write" on public.interview_feedback for all to authenticated
  using (public.owns_interview(session_id)) with check (public.owns_interview(session_id));
