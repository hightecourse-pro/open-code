-- Applications that happened OUTSIDE the community (the owner, 31/8): a
-- woman applied by email before she had an account. The team records her
-- email against the job; the moment she signs in with that email, a real
-- applications row is created for her (claim in lib/claim-external) and the
-- job shows up in her "ההגשות שלי" — submitted_at keeps the ORIGINAL date.
create table public.external_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  email text not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_profile_id uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz
);

-- Emails are lowercased by the ONLY writer (the admin action) — plain
-- column indexes so PostgREST upsert onConflict can target them.
create unique index external_applications_job_email
  on public.external_applications (job_id, email);
create index external_applications_unclaimed_email
  on public.external_applications (email) where claimed_at is null;

-- Emails of women who are not members yet — team eyes only.
alter table public.external_applications enable row level security;
create policy "external_applications_admin" on public.external_applications
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
