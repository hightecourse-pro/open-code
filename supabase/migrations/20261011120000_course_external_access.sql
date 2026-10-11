-- A second kind of course (the owner, 11/10): recordings that live on another
-- site behind a username + password (e.g. "חדשנות ו-AI פרקטי לבדיקות
-- ואוטומציה" on atidcollege.co.il), instead of a Google Drive folder we share.
-- The course row says which kind it is; the external links + credentials live
-- in their own service-role-only table, passwords encrypted at rest.
alter table public.courses
  add column if not exists access_kind text not null default 'drive';
-- drive | external

create table if not exists public.course_external_access (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses (id) on delete cascade,
  -- "הקלטות משנת 2025"
  label         text not null,
  url           text not null,
  username      text,
  -- encryptSecret() payload (AI_KEY_SECRET) - never the plain password.
  password_enc  text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists course_external_access_course_idx
  on public.course_external_access (course_id, sort_order);

-- No member policies on purpose: the course page reads it with the service
-- role only for a member whose course this is, and decrypts on the server.
alter table public.course_external_access enable row level security;
