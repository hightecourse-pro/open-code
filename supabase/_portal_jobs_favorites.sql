-- ============================================================================
-- Open Code — portal "My Jobs" recommendations + "My Favorites". Run in the
-- SQL Editor. Safe to re-run.
--
--   job_candidates   : the candidates an admin curated for a client's job.
--                      The client sees exactly these under "המשרות שלי".
--                      Admins add/remove at any time.
--   portal_favorites : candidates a client marked for herself ("המועדפות שלי").
--
-- Both are admin-only under RLS. The portal itself authenticates with its own
-- cookie and reads/writes through the service role, after verifying the portal
-- session in code — so no member/anon policy is needed (or wanted).
-- ============================================================================

create table if not exists public.job_candidates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (job_id, profile_id)
);

create index if not exists job_candidates_job_idx on public.job_candidates (job_id);

alter table public.job_candidates enable row level security;
drop policy if exists "job_candidates_admin" on public.job_candidates;
create policy "job_candidates_admin" on public.job_candidates
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.portal_favorites (
  client_id uuid not null references public.portal_clients(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, profile_id)
);

alter table public.portal_favorites enable row level security;
drop policy if exists "portal_favorites_admin" on public.portal_favorites;
create policy "portal_favorites_admin" on public.portal_favorites
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
