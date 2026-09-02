-- ============================================================================
-- AI tool telemetry (2/9): 17 paying members added valid keys and none got a
-- CV review — with nothing recorded anywhere to say why. Every run now logs
-- its outcome, so "לא עובד" becomes a row we can read. Admin-only.
-- ============================================================================

create table if not exists public.ai_tool_runs (
  id         uuid primary key default gen_random_uuid(),
  tool       text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  ok         boolean not null,
  error      text,
  meta       jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_tool_runs_time_idx on public.ai_tool_runs (created_at desc);

alter table public.ai_tool_runs enable row level security;
drop policy if exists ai_tool_runs_admin on public.ai_tool_runs;
create policy ai_tool_runs_admin on public.ai_tool_runs
  for select using (public.is_admin());
