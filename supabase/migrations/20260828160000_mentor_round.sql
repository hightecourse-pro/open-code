-- Shira's mentor round (2026-08-28):
--   * reopening a handled request now records WHY (and when) — including the
--     automatic "המנטורית סירבה" case, so declines are finally visible;
--   * a mentor can be marked temporarily unavailable without cancelling her;
--   * cancellations / availability changes leave an audit trail.
alter table public.mentor_requests add column if not exists reopen_reason text;
alter table public.mentor_requests add column if not exists reopened_at timestamptz;
alter table public.profiles add column if not exists mentor_available boolean not null default true;

create table if not exists public.mentor_admin_log (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table public.mentor_admin_log enable row level security;
drop policy if exists mentor_admin_log_admin on public.mentor_admin_log;
create policy mentor_admin_log_admin on public.mentor_admin_log
  for all using (is_admin());
