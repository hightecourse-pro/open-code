-- Course registrations (the owner, 25/9): the public sales page
-- /masters-course sends a woman through a registration step before Shufra's
-- Nedarim payment page (mosad 7009686 - not our account, so no callback lands
-- here). Every registration is recorded so the team can follow up:
-- "אני רק צריכה להתעדכן על כל אחת שנרשמה".
create table if not exists public.course_registrations (
  id              uuid primary key default gen_random_uuid(),
  course_key      text not null default 'masters-2026',
  email           text not null,
  full_name       text not null,
  phone           text,
  -- The community account behind the email, when there is one.
  profile_id      uuid references public.profiles (id) on delete set null,
  -- Snapshot of the membership check at registration time (the scholarship
  -- depends on it): active + paid at that moment.
  is_subscriber   boolean not null default false,
  membership_note text,
  -- registered | paid | canceled - maintained by the team (payment is on
  -- Shufra's side, so "paid" is a manual confirmation).
  status          text not null default 'registered',
  paid_at         timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One row per woman per course; a second submit updates her details.
create unique index if not exists course_registrations_course_email_idx
  on public.course_registrations (course_key, lower(email));

create index if not exists course_registrations_created_idx
  on public.course_registrations (course_key, created_at desc);

-- Team-only data: written by the public form through the service role, read
-- and edited by the admin screen the same way. No member policies.
alter table public.course_registrations enable row level security;
