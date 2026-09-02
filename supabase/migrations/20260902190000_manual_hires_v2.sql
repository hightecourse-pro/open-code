-- ============================================================================
-- Manual hires v2 (the owner, 2/9): email, company and job type on each
-- off-community placement, plus an optional link to her profile — set at
-- insert when the email already belongs to a member, and lazily the moment
-- she joins later. The banner turns her name into a link when it exists.
-- ============================================================================

alter table public.manual_hires
  add column if not exists email      text,
  add column if not exists company    text,
  add column if not exists job_type   text
    check (job_type in ('practicum_placement', 'temp', 'immediate') or job_type is null),
  add column if not exists profile_id uuid references public.profiles (id) on delete set null;
