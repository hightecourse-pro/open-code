-- Grade sheets (the owner, 19/9): juniors may attach a transcript, optional
-- in the questionnaire, manageable from the CV screen. Files live in the
-- private 'cvs' bucket under <uid>/grades/ — the existing per-folder storage
-- policies already scope them to their owner (and admins).
create table if not exists public.grade_sheets (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label      text not null,
  file_path  text not null,
  file_name  text not null,
  created_at timestamptz not null default now()
);

create index if not exists grade_sheets_profile_idx on public.grade_sheets (profile_id, created_at desc);

alter table public.grade_sheets enable row level security;

drop policy if exists grade_sheets_own_select on public.grade_sheets;
create policy grade_sheets_own_select on public.grade_sheets
  for select using (auth.uid() = profile_id or public.is_admin());
drop policy if exists grade_sheets_own_insert on public.grade_sheets;
create policy grade_sheets_own_insert on public.grade_sheets
  for insert with check (auth.uid() = profile_id);
drop policy if exists grade_sheets_own_delete on public.grade_sheets;
create policy grade_sheets_own_delete on public.grade_sheets
  for delete using (auth.uid() = profile_id);
