-- ============================================================================
-- Open Code — course library units (run once in the SQL Editor)
-- The recorded-courses library: a course (one per "קוד קורס" in the Excel)
-- contains units/קוביות — a named year-cycle with its own recordings and a
-- materials folder. Links stay in content_links so the automatic Drive
-- sharing (grant on enroll, revoke on return) covers them with zero changes.
-- Safe to re-run.
-- ============================================================================

-- 1. The units themselves.
create table if not exists public.course_units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  year int,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.course_units enable row level security;

do $$ begin
  create policy "course units are readable by members"
    on public.course_units for select to authenticated using (true);
exception when duplicate_object then null; end $$;

-- 2. A link may belong to a unit (legacy links simply have no unit).
alter table public.content_links
  add column if not exists unit_id uuid references public.course_units(id) on delete cascade;

-- 3. The Excel course code — the stable import key for re-seeding.
alter table public.courses add column if not exists code int;
create unique index if not exists courses_code_key
  on public.courses (code) where code is not null;
