-- Questionnaire reminders (the owner, 18/9): a member who has not finished
-- the profile questionnaire two weeks after joining gets a friendly email
-- (mentor / junior wording). Every send is recorded here so the members
-- table shows the last reminder and, on click, every date.
create table if not exists public.profile_reminders (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       text not null default 'questionnaire',
  sent_at    timestamptz not null default now()
);

create index if not exists profile_reminders_profile_idx
  on public.profile_reminders (profile_id, sent_at desc);

-- Team-only data: written by the cron through the service role, read by the
-- admin screens the same way. No member policies.
alter table public.profile_reminders enable row level security;
