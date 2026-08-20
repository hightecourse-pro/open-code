-- ============================================================================
-- קוד פתוח — מרכז התראות במערכת הניהול.
--
-- Alerts used to be emails: throttled to one an hour, gone the moment the
-- inbox scrolled, invisible to any admin who wasn't the addressee. This table
-- is the permanent record the admin UI reads — every payment rejection, every
-- expired subscription, every Drive failure, with an unread count on the
-- sidebar. Email remains only a secondary ping for money-critical events.
--
-- Writes come exclusively through the service role (no insert policy, on
-- purpose): alerts are raised by webhooks and crons, never by browsers.
-- dedupe_key collapses repeats (a probe storm becomes one row with a count).
-- ============================================================================

create table if not exists public.admin_alerts (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null,
  severity     text not null default 'warning'
    check (severity in ('critical', 'warning', 'info')),
  title        text not null,
  body         text,
  context      jsonb,
  dedupe_key   text unique,
  count        int not null default 1,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  read_at      timestamptz
);

create index if not exists admin_alerts_unread_idx
  on public.admin_alerts (created_at desc) where read_at is null;

alter table public.admin_alerts enable row level security;

drop policy if exists "admin_alerts_select" on public.admin_alerts;
create policy "admin_alerts_select" on public.admin_alerts
  for select to authenticated using ( ( SELECT public.is_admin() ) );

drop policy if exists "admin_alerts_update" on public.admin_alerts;
create policy "admin_alerts_update" on public.admin_alerts
  for update to authenticated
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );
