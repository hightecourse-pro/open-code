-- Per-candidate-per-job outcome note (the owner, 7/9): "הוגשה ל-N מקומות"
-- with, per place, the team's note on why she did not continue / was not
-- chosen. One row per (job, candidate) regardless of how she was submitted
-- (application forward or proactive job_candidates row). Admin-only.
create table if not exists public.submission_outcomes (
  job_id     uuid not null references public.jobs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  note       text,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (job_id, profile_id)
);

alter table public.submission_outcomes enable row level security;
drop policy if exists submission_outcomes_admin on public.submission_outcomes;
create policy submission_outcomes_admin on public.submission_outcomes
  for all using (public.is_admin()) with check (public.is_admin());
