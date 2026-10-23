-- Hackathon videos mirrored to the owner's Drive folder with PERSONAL sharing
-- per judge (the owner, 23/10 - Netfree). One row per (file, judge) so the
-- sync never re-shares what it already shared.
create table if not exists public.hackathon_drive_shares (
  drive_file_id text not null,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (drive_file_id, profile_id)
);
alter table public.hackathon_drive_shares enable row level security;
drop policy if exists "hackathon_drive_shares_admin" on public.hackathon_drive_shares;
create policy "hackathon_drive_shares_admin" on public.hackathon_drive_shares
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant all on public.hackathon_drive_shares to service_role;
grant select, insert, delete on public.hackathon_drive_shares to authenticated;
