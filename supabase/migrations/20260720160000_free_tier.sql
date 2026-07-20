-- ============================================================================
-- Open Code — free (read-only) membership tier. Run in the SQL Editor.
-- Safe to re-run.
--
-- Until now only a paying member could enter at all. From now on anyone who
-- signed up can browse the community, and paying is what unlocks taking part:
--
--   free   : browse the forum, search members, see jobs/courses/sessions
--            listings, edit her own profile
--   paying : everything above + join links, recordings, posting, courses,
--            AI tools, mentor chat
--
-- Two layers do the work:
--   1. is_member()  — signed in and not rejected → may READ community content.
--   2. has_active_sub() — unchanged → may WRITE and reach paid material.
--
-- Join links (sessions.zoom_url) and recording URLs (recordings.video_url)
-- are the paid goods, and RLS can't hide a single column — so free members
-- read the sanitized VIEWS below, which simply don't contain those columns.
-- ============================================================================

-- 1. Who counts as a member at all ------------------------------------------
create or replace function public.is_member()
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status <> 'rejected'
  );
$$;

-- …and who counts as a paying one. The app decides this from profiles.status
-- (that's what activation and admin approval set), so the database must agree
-- — otherwise a member the app treats as paying has her writes silently
-- rejected by RLS. The subscriptions table stays as the billing record.
create or replace function public.has_active_sub()
returns boolean language sql security definer stable set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'active'
  );
$$;

-- 1b. Her Google address is private -----------------------------------------
-- With open signup, every member can now read the profiles table, and RLS
-- can't hide a single column — so the Drive address moves to its own
-- owner-only table.
create table if not exists public.member_private (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  drive_email text,
  drive_email_requested_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.member_private enable row level security;

drop policy if exists "member_private_own" on public.member_private;
create policy "member_private_own" on public.member_private
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

-- Carry over anything already stored on profiles, then blank it there.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'drive_email'
  ) then
    insert into public.member_private (profile_id, drive_email, drive_email_requested_at)
    select id, drive_email, drive_email_requested_at
    from public.profiles
    where drive_email is not null or drive_email_requested_at is not null
    on conflict (profile_id) do nothing;

    alter table public.profiles drop column drive_email;
    alter table public.profiles drop column drive_email_requested_at;
  end if;
end $$;

-- 2. Browsing: open reads to every member ------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_member());

drop policy if exists "mentor_profiles_select" on public.mentor_profiles;
create policy "mentor_profiles_select" on public.mentor_profiles
  for select to authenticated using (public.is_member());

drop policy if exists "posts_select" on public.posts;
create policy "posts_select" on public.posts
  for select to authenticated
  using (
    public.is_member()
    and (status = 'visible' or author_id = (select auth.uid()) or public.is_admin())
  );

drop policy if exists "comments_select" on public.comments;
create policy "comments_select" on public.comments
  for select to authenticated using (public.is_member());

drop policy if exists "reactions_select" on public.reactions;
create policy "reactions_select" on public.reactions
  for select to authenticated using (public.is_member());

drop policy if exists "jobs_select" on public.jobs;
create policy "jobs_select" on public.jobs for select to authenticated
  using (public.is_member() and (is_visible or public.is_admin()));

drop policy if exists "courses_select" on public.courses;
create policy "courses_select" on public.courses for select to authenticated
  using (public.is_member() and (is_published or public.is_admin()));

drop policy if exists "articles_select" on public.articles;
create policy "articles_select" on public.articles for select to authenticated
  using (public.is_member() or public.is_admin());

-- Reporting bad content must never be behind a paywall.
drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.is_member());

-- Applying to a job is open; the board makes the subscriber priority explicit.
drop policy if exists "applications_own_write" on public.applications;
create policy "applications_own_write" on public.applications for insert to authenticated
  with check (applicant_id = (select auth.uid()) and public.is_member());

-- 3. Paid goods stay paid ----------------------------------------------------
-- sessions / recordings / content_links keep their has_active_sub() policies,
-- so a free member can't read a join link or a Drive link from the API.
-- She reads these sanitized views instead — note they deliberately omit
-- zoom_url and video_url.

create or replace view public.sessions_public
with (security_invoker = false) as
  select id, title, topic, scheduled_at, status, is_published, recording_id,
         canceled_at, created_at, updated_at
  from public.sessions
  where is_published and public.is_member();

create or replace view public.recordings_public
with (security_invoker = false) as
  select id, title, category, duration_sec, is_free, session_id,
         cover_variant, published_at
  from public.recordings
  where public.is_member();

grant select on public.sessions_public to authenticated;
grant select on public.recordings_public to authenticated;
