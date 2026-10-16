-- הגשת התוצרים להאקתון (the owner, 16/10): one submission per team (a solo
-- registrant, or a confirmed pair - either partner may fill it), plus the
-- personal reflections, one row per woman.

create table public.hackathon_submissions (
  id             uuid primary key default gen_random_uuid(),
  -- The team: the registrant's id, or both ids of a confirmed pair sorted and joined with '+'.
  team_key       text not null unique,
  challenge_key  text not null,
  product_url    text,
  repo_url       text,
  architecture   text,
  video_url      text,
  video_path     text,
  video_size     bigint,
  ai_dev_tools   text,
  ai_models      text,
  created_by     uuid references public.profiles (id) on delete set null,
  submitted_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger hackathon_submissions_set_updated_at
  before update on public.hackathon_submissions
  for each row execute function public.set_updated_at();

create table public.hackathon_reflections (
  profile_id   uuid primary key references public.profiles (id) on delete cascade,
  team_key     text not null,
  contributed  text,
  learned      text,
  enjoyed      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index hackathon_reflections_team_idx on public.hackathon_reflections (team_key);
create trigger hackathon_reflections_set_updated_at
  before update on public.hackathon_reflections
  for each row execute function public.set_updated_at();

alter table public.hackathon_submissions enable row level security;
alter table public.hackathon_reflections enable row level security;
-- Members reach their own team's rows through server actions (service role);
-- the team reads and moderates everything.
create policy "hackathon_submissions_admin" on public.hackathon_submissions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "hackathon_reflections_admin" on public.hackathon_reflections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
