-- שיפוט ההאקתון (the owner, 16/10): the team and the mentors she appoints
-- score every submission on six criteria; the automated check report sits
-- beside the scores as the "testing dashboard" that runs before humans judge.

create table public.hackathon_judges (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.hackathon_scores (
  id            uuid primary key default gen_random_uuid(),
  team_key      text not null,
  judge_id      uuid not null references public.profiles (id) on delete cascade,
  works         smallint not null default 0 check (works between 0 and 25),
  correctness   smallint not null default 0 check (correctness between 0 and 25),
  problem       smallint not null default 0 check (problem between 0 and 15),
  architecture  smallint not null default 0 check (architecture between 0 and 15),
  ux            smallint not null default 0 check (ux between 0 and 10),
  presentation  smallint not null default 0 check (presentation between 0 and 10),
  -- One short line per criterion - the feedback the team gets.
  notes         jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (team_key, judge_id)
);
create index hackathon_scores_team_idx on public.hackathon_scores (team_key);
create trigger hackathon_scores_set_updated_at
  before update on public.hackathon_scores
  for each row execute function public.set_updated_at();

-- The automated report per team: checks (pass/fail/warn/skip + detail), a
-- summary and suggested scores. Written by the team's tooling, read by judges.
create table public.hackathon_auto_reports (
  team_key   text primary key,
  report     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger hackathon_auto_reports_set_updated_at
  before update on public.hackathon_auto_reports
  for each row execute function public.set_updated_at();

alter table public.hackathon_judges enable row level security;
alter table public.hackathon_scores enable row level security;
alter table public.hackathon_auto_reports enable row level security;
create policy "hackathon_judges_admin" on public.hackathon_judges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "hackathon_scores_admin" on public.hackathon_scores
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "hackathon_auto_reports_admin" on public.hackathon_auto_reports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
