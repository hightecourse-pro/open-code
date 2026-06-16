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
