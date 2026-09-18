-- The hires celebration banner, per member (the owner, 18/9): it opens by
-- itself only when there is news SHE has not seen yet, unseen names carry a
-- "חדש" mark, and the mark drops after her first look. Written only through
-- server actions (service role) — no member policies needed.
create table if not exists public.hire_banner_seen (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  seen_hire_ids uuid[] not null default '{}',
  updated_at    timestamptz not null default now()
);

alter table public.hire_banner_seen enable row level security;

-- She may read her own row (harmless; the layout reads through the service
-- role anyway).
drop policy if exists hire_banner_seen_own on public.hire_banner_seen;
create policy hire_banner_seen_own on public.hire_banner_seen
  for select using (auth.uid() = profile_id);
