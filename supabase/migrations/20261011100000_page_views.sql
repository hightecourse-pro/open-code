-- Visits (the owner, 11/10: "מנגנון מלא של כניסות לאתר, לקהילה, לדף ההאקתון
-- ולדף הקורס - אני רוצה לדעת כמה נכנסו"). One row per page view, sent by a
-- tiny beacon from the browser (so crawlers and bots, which do not run it, are
-- not counted). The visitor is an anonymous cookie id; a logged-in member is
-- also recorded by profile, so "כמה נכנסו" can be answered as views, people
-- and members. Aggregation happens in the database (the three functions below),
-- never by shipping rows to the admin page.
create table if not exists public.page_views (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  -- site | community | hackathon | course | portal | coordinator
  area        text not null,
  path        text not null,
  -- the anonymous visitor cookie (oc_vid)
  visitor     text not null,
  profile_id  uuid references public.profiles (id) on delete set null,
  referrer    text,
  utm_source  text,
  utm_campaign text,
  -- mobile | desktop
  device      text
);

create index if not exists page_views_at_idx on public.page_views (at desc);
create index if not exists page_views_area_at_idx on public.page_views (area, at desc);

-- Service role only: written by the beacon route, read by the admin screen.
alter table public.page_views enable row level security;

-- Totals per area for a window, plus one '*' row for everything together.
create or replace function public.page_views_summary(p_from timestamptz, p_to timestamptz)
returns table (area text, views bigint, visitors bigint, members bigint)
language sql
security definer
set search_path = ''
as $$
  select area, count(*) as views, count(distinct visitor) as visitors, count(distinct profile_id) as members
  from public.page_views
  where at >= p_from and at < p_to
  group by area
  union all
  select '*' as area, count(*) as views, count(distinct visitor) as visitors, count(distinct profile_id) as members
  from public.page_views
  where at >= p_from and at < p_to;
$$;
revoke all on function public.page_views_summary(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.page_views_summary(timestamptz, timestamptz) to service_role;

-- Per Israel-time day and area.
create or replace function public.page_views_daily(p_from timestamptz, p_to timestamptz)
returns table (day date, area text, views bigint, visitors bigint)
language sql
security definer
set search_path = ''
as $$
  select (at at time zone 'Asia/Jerusalem')::date as day, area, count(*) as views, count(distinct visitor) as visitors
  from public.page_views
  where at >= p_from and at < p_to
  group by 1, 2
  order by 1, 2;
$$;
revoke all on function public.page_views_daily(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.page_views_daily(timestamptz, timestamptz) to service_role;

-- The most visited pages of a window.
create or replace function public.page_views_top_paths(p_from timestamptz, p_to timestamptz, p_limit int)
returns table (area text, path text, views bigint, visitors bigint)
language sql
security definer
set search_path = ''
as $$
  select area, path, count(*) as views, count(distinct visitor) as visitors
  from public.page_views
  where at >= p_from and at < p_to
  group by area, path
  order by views desc
  limit p_limit;
$$;
revoke all on function public.page_views_top_paths(timestamptz, timestamptz, int) from public, anon, authenticated;
grant execute on function public.page_views_top_paths(timestamptz, timestamptz, int) to service_role;
