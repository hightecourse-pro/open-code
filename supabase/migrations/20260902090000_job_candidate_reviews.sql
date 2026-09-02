-- ============================================================================
-- Candidate triage per job (the owner, 2/9): the finder tab's saved verdicts —
-- מתאימה / אולי / לא — plus the optional AI score+reason. One row per
-- (job, member); admin-only.
-- ============================================================================

create table if not exists public.job_candidate_reviews (
  job_id     uuid not null references public.jobs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'new'
             check (status in ('new', 'fit', 'maybe', 'no')),
  ai_score   int,
  ai_reason  text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (job_id, profile_id)
);

alter table public.job_candidate_reviews enable row level security;

drop policy if exists job_candidate_reviews_admin on public.job_candidate_reviews;
create policy job_candidate_reviews_admin on public.job_candidate_reviews
  for all using (public.is_admin()) with check (public.is_admin());
