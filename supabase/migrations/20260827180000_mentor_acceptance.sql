-- Mentor round (2026-08-27):
-- 1. An assignment now needs the MENTOR's acceptance before the member sees
--    her — mentor_accepted_at is stamped when she says yes. Existing
--    assignments were made under the old implicit-consent flow — backfilled
--    as accepted so nobody's mentor disappears.
alter table public.mentor_requests
  add column if not exists mentor_accepted_at timestamptz;

update public.mentor_requests
   set mentor_accepted_at = coalesce(handled_at, created_at)
 where assigned_mentor_id is not null and mentor_accepted_at is null;

-- 2. Manual bonus points — a ledger only for what CAN'T be computed
--    (the computed part stays computed).
create table if not exists public.mentor_bonus_points (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.profiles(id) on delete cascade,
  points     int  not null,
  reason     text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists mentor_bonus_points_mentor_idx
  on public.mentor_bonus_points (mentor_id);

alter table public.mentor_bonus_points enable row level security;
create policy "mentor_bonus_admin" on public.mentor_bonus_points
  for all using ( ( select public.is_admin() ) )
  with check ( ( select public.is_admin() ) );
