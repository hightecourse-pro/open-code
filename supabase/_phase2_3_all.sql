-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Open Code — Phase 2 + 3 + AI keys bundle                    ║
-- ║  Paste into Supabase → SQL Editor → Run (after Phase 1).      ║
-- ║  Includes demo seed at the end. Canonical = migrations/.      ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ============================================================================
-- Open Code — Phase 2 (career engine): jobs, courses, recordings, sessions, chat
-- ============================================================================

create type public.job_source as enum ('ours', 'open');
create type public.job_status as enum ('open', 'closed');
create type public.employment_type as enum ('full', 'part', 'student', 'freelance');
create type public.application_status as enum ('draft', 'submitted', 'in_review', 'accepted', 'rejected');
create type public.enrollment_status as enum ('active', 'completed', 'returned');
create type public.session_status as enum ('scheduled', 'live', 'done');

-- ---------------------------------------------------------------- jobs
create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  company         text not null,
  title           text not null,
  source          public.job_source not null default 'open',
  location        text,
  region          text,
  employment_type public.employment_type not null default 'full',
  description     text not null default '',
  tech_tags       text[] not null default '{}',
  external_url    text,
  target_criteria jsonb not null default '{}'::jsonb,
  logo_variant    int not null default 1,
  is_visible      boolean not null default true,
  status          public.job_status not null default 'open',
  posted_by       uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index jobs_visible_idx on public.jobs (is_visible, status, created_at desc);
create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function public.set_updated_at();

create table public.applications (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  status       public.application_status not null default 'submitted',
  note         text,
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (job_id, applicant_id)
);
create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

create table public.saved_jobs (
  job_id     uuid not null references public.jobs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, profile_id)
);

create table public.job_offers (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  sent_at    timestamptz not null default now(),
  unique (job_id, profile_id)
);

-- ---------------------------------------------------------------- courses
create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text,
  tech_tags     text[] not null default '{}',
  lessons_count int not null default 0,
  duration_hours numeric not null default 0,
  instructor    text,
  drive_url     text,
  cover_variant int not null default 1,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

create table public.enrollments (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  course_id       uuid not null references public.courses (id) on delete cascade,
  status          public.enrollment_status not null default 'active',
  progress_pct    int not null default 0,
  shared_to_email text,
  last_switch_month date,
  started_at      timestamptz not null default now(),
  switched_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (profile_id, course_id)
);
-- One active course per member at a time (the "library loan" model).
create unique index one_active_enrollment on public.enrollments (profile_id) where status = 'active';
create trigger enrollments_set_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- recordings
create table public.recordings (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text,
  duration_sec int not null default 0,
  video_url    text,
  is_free      boolean not null default false,
  session_id   uuid,
  cover_variant int not null default 1,
  published_at timestamptz not null default now()
);

create table public.recording_views (
  recording_id uuid not null references public.recordings (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  watched_at   timestamptz not null default now(),
  primary key (recording_id, profile_id)
);

-- ---------------------------------------------------------------- sessions
create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  topic        text,
  leader_id    uuid references public.profiles (id) on delete set null,
  scheduled_at timestamptz not null,
  zoom_url     text,
  status       public.session_status not null default 'scheduled',
  is_published boolean not null default true,
  recording_id uuid references public.recordings (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger sessions_set_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();

alter table public.recordings
  add constraint recordings_session_fk foreign key (session_id)
  references public.sessions (id) on delete set null;

-- ---------------------------------------------------------------- chat
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  a_id            uuid not null references public.profiles (id) on delete cascade,
  b_id            uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (a_id, b_id)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- helper: is the current user a participant of a conversation?
create or replace function public.in_conversation(conv uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv and ((select auth.uid()) in (c.a_id, c.b_id))
  );
$$;

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.job_offers enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.recordings enable row level security;
alter table public.recording_views enable row level security;
alter table public.sessions enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- jobs: active members see visible/open jobs; admins manage
create policy "jobs_select" on public.jobs for select to authenticated
  using (public.has_active_sub() and (is_visible or public.is_admin()));
create policy "jobs_admin_write" on public.jobs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- applications: own; admin read/manage
create policy "applications_own_select" on public.applications for select to authenticated
  using (applicant_id = (select auth.uid()) or public.is_admin());
create policy "applications_own_write" on public.applications for insert to authenticated
  with check (applicant_id = (select auth.uid()) and public.has_active_sub());
create policy "applications_own_update" on public.applications for update to authenticated
  using (applicant_id = (select auth.uid()) or public.is_admin())
  with check (applicant_id = (select auth.uid()) or public.is_admin());

-- saved_jobs: own only
create policy "saved_jobs_own" on public.saved_jobs for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- job_offers: target member or admin
create policy "job_offers_select" on public.job_offers for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy "job_offers_admin_write" on public.job_offers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- courses: active members see published; admins manage
create policy "courses_select" on public.courses for select to authenticated
  using (public.has_active_sub() and (is_published or public.is_admin()));
create policy "courses_admin_write" on public.courses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- enrollments: own; admin read
create policy "enrollments_select" on public.enrollments for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy "enrollments_write_own" on public.enrollments for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()) and public.has_active_sub());

-- recordings: active members; admins manage
create policy "recordings_select" on public.recordings for select to authenticated
  using (public.has_active_sub());
create policy "recordings_admin_write" on public.recordings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "recording_views_own" on public.recording_views for all to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- sessions: active members see published; admins manage
create policy "sessions_select" on public.sessions for select to authenticated
  using (public.has_active_sub() and (is_published or public.is_admin()));
create policy "sessions_admin_write" on public.sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- conversations + messages: participants only
create policy "conversations_select" on public.conversations for select to authenticated
  using (a_id = (select auth.uid()) or b_id = (select auth.uid()));
create policy "conversations_insert" on public.conversations for insert to authenticated
  with check ((a_id = (select auth.uid()) or b_id = (select auth.uid())) and public.has_active_sub());
create policy "messages_select" on public.messages for select to authenticated
  using (public.in_conversation(conversation_id));
create policy "messages_insert" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.in_conversation(conversation_id));

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

-- ============================================================================
-- Open Code — per-user AI keys (BYO Google Gemini key)
-- Each member adds and manages her own Google API key. Stored encrypted
-- (AES-256-GCM, app-level, via AI_KEY_SECRET) — the DB never holds plaintext.
-- Owner-only RLS; not even admins can read another member's key.
-- ============================================================================

create table public.user_ai_keys (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  provider     text not null default 'google',
  label        text,
  key_cipher   text not null,          -- AES-256-GCM ciphertext (iv.tag.data)
  key_last4    text,                   -- for masked display only
  status       text not null default 'active', -- active | exhausted | invalid
  last_error   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index user_ai_keys_owner_idx on public.user_ai_keys (profile_id, created_at desc);

alter table public.user_ai_keys enable row level security;

-- Strictly owner-only — no admin override (these are personal credentials).
create policy "user_ai_keys_owner_all" on public.user_ai_keys for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ============================================================================
-- Open Code — Phase 2 demo seed (jobs, courses, recordings, sessions)
-- Idempotent-ish: clears demo rows by a marker comment then re-inserts.
-- Safe to run after the Phase 2 migration.
-- ============================================================================

-- ---- jobs ----
insert into public.jobs (company, title, source, location, region, employment_type, description, tech_tags, logo_variant, status) values
  ('Wix', 'Junior Frontend Developer', 'ours', 'תל אביב', 'center', 'full',
   'הצטרפי לצוות פרונטאנד צעיר ותומך. נשמח לג''וניוריות עם בסיס ב-React ורצון ללמוד.',
   '{react,javascript,css}', 1, 'open'),
  ('monday.com', 'Junior Fullstack', 'ours', 'תל אביב', 'center', 'full',
   'תפקיד פולסטאק לג''וניורית — עבודה עם Node.js ו-React לצד מנטורינג צמוד.',
   '{nodejs,react,typescript}', 2, 'open'),
  ('Papaya Global', 'QA Engineer (Junior)', 'open', 'הרצליה', 'sharon', 'full',
   'בדיקות אוטומציה ומנואל למוצר גלובלי. אין צורך בניסיון קודם — נלמד אותך.',
   '{python,sql}', 4, 'open'),
  ('Fiverr', 'Student Backend Developer', 'open', 'מרחוק', 'remote', 'student',
   'משרת סטודנטית בבאקאנד, גמישה לשעות לימודים.',
   '{nodejs,sql}', 4, 'open'),
  ('Riskified', 'Frontend Developer', 'ours', 'תל אביב', 'center', 'full',
   'צוות פרונטאנד שאוהב לחנוך ג''וניוריות. סטאק מודרני, קוד נקי.',
   '{react,typescript,css}', 2, 'open'),
  ('Lemonade', 'Junior Data Analyst', 'open', 'תל אביב', 'center', 'part',
   'ניתוח נתונים ותמיכה בצוות הדאטה. מתאים לבוגרות בוטקאמפ דאטה.',
   '{python,sql}', 1, 'open');

-- ---- courses ----
insert into public.courses (title, category, tech_tags, lessons_count, duration_hours, instructor, cover_variant, is_published) values
  ('יסודות JavaScript', 'בסיס', '{javascript}', 12, 8, 'דנה לוי', 1, true),
  ('React מאפס למתקדמות', 'פרונטאנד', '{react,javascript}', 18, 14, 'נועה כהן', 2, true),
  ('Node.js ו-APIs', 'באקאנד', '{nodejs,sql}', 14, 10, 'שירה אבני', 3, true),
  ('TypeScript בעבודה', 'שפות', '{typescript}', 10, 6, 'מאיה גל', 6, true),
  ('SQL ומסדי נתונים', 'דאטה', '{sql}', 9, 5, 'רותם בר', 4, true),
  ('הכנה לראיונות טכניים', 'קריירה', '{javascript,react}', 8, 4, 'יעל שמש', 5, true);

-- ---- recordings ----
insert into public.recordings (title, category, duration_sec, is_free, cover_variant) values
  ('בניית RAG עם LangChain', 'AI', 3600, false, 2),
  ('מבוא ל-Git ו-GitHub', 'כלים', 2700, true, 1),
  ('איך עוברים ראיון HR', 'קריירה', 1800, true, 5),
  ('CSS מודרני — Grid ו-Flexbox', 'פרונטאנד', 3000, false, 6),
  ('עקרונות עיצוב API', 'באקאנד', 3300, false, 3),
  ('דיבוג כמו מקצוענית', 'כלים', 2400, false, 4);

-- ---- sessions (upcoming + past) ----
insert into public.sessions (title, topic, scheduled_at, status, is_published) values
  ('סשן שבועי: בניית RAG עם LangChain', 'AI', now() + interval '2 days', 'scheduled', true),
  ('Office Hours עם מנטוריות', 'קריירה', now() + interval '6 days', 'scheduled', true),
  ('סדנת ראיונות מקצועיים', 'קריירה', now() + interval '13 days', 'scheduled', true),
  ('מבוא ל-Docker', 'DevOps', now() - interval '5 days', 'done', true);
