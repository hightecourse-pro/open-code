-- ============================================================================
-- Open Code — mentor requests (run in the SQL Editor). Safe to re-run.
-- A member with no mentor yet can ask to be matched with one: she picks a
-- reason and can add free text. Admins see the queue in the admin area and
-- get an email for every new request.
-- ============================================================================

create table if not exists public.mentor_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,          -- interview_prep | first_months | professional | personal
  note text,                     -- free text from the member
  status text not null default 'open',   -- open | handled
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

create index if not exists mentor_requests_status_idx
  on public.mentor_requests (status, created_at desc);

alter table public.mentor_requests enable row level security;

-- A member sees and creates only her own requests…
drop policy if exists "mentor_requests_own" on public.mentor_requests;
create policy "mentor_requests_own" on public.mentor_requests
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

drop policy if exists "mentor_requests_insert_own" on public.mentor_requests;
create policy "mentor_requests_insert_own" on public.mentor_requests
  for insert to authenticated
  with check (profile_id = (select auth.uid()));

-- …and only admins can resolve them.
drop policy if exists "mentor_requests_admin_update" on public.mentor_requests;
create policy "mentor_requests_admin_update" on public.mentor_requests
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "mentor_requests_admin_delete" on public.mentor_requests;
create policy "mentor_requests_admin_delete" on public.mentor_requests
  for delete to authenticated
  using (public.is_admin());
