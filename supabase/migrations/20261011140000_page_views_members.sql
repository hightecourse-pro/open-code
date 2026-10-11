-- Visits per member for a window (the owner, 11/10: "דוח של הכניסות עם שם
-- וכתובת מייל"). Aggregated in the database like the other page_views_*
-- functions; the names and emails are joined on the server.
create or replace function public.page_views_members(p_from timestamptz, p_to timestamptz)
returns table (profile_id uuid, views bigint, first_at timestamptz, last_at timestamptz, areas text)
language sql
security definer
set search_path = ''
as $$
  select profile_id, count(*) as views, min(at) as first_at, max(at) as last_at,
         string_agg(distinct area, ',' order by area) as areas
  from public.page_views
  where profile_id is not null and at >= p_from and at < p_to
  group by profile_id
  order by views desc, last_at desc;
$$;
revoke all on function public.page_views_members(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.page_views_members(timestamptz, timestamptz) to service_role;
