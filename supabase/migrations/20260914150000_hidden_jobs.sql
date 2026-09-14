-- Personal job hiding (member feedback, 14/9): a job that isn't relevant to
-- her leaves HER board only — with a way back (the "הוסתרו" view). Mirrors
-- saved_jobs exactly: own rows, nothing else.
create table if not exists public.hidden_jobs (
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, profile_id)
);

alter table public.hidden_jobs enable row level security;

drop policy if exists hidden_jobs_own on public.hidden_jobs;
create policy hidden_jobs_own on public.hidden_jobs
  for all
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
