-- ============================================================================
-- Open Code — the community layer grows up. Run once in the SQL Editor.
--
--   1. A members directory every member can browse — WITHOUT exposing who
--      pays. profiles carries status and member_tier, and RLS cannot hide a
--      column, so the directory reads a view that simply never selects them.
--   2. A short editing window on posts and comments (the app enforces ten
--      minutes; the column just records that an edit happened).
-- Safe to re-run.
-- ============================================================================

-- 1. "Edited" markers -------------------------------------------------------
alter table public.posts    add column if not exists edited_at timestamptz;
alter table public.comments add column if not exists edited_at timestamptz;

-- A member may edit her OWN post/comment. The ten-minute limit lives in the
-- server action — RLS guarantees the ownership half, which is the security
-- half; a stale clock must never be what stands between her and her words.
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own" on public.posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

-- 2. The members directory --------------------------------------------------
-- Deliberately narrow: a name, how to recognise her, what she does. No
-- status, no member_tier, no workplace, no contact details — one member must
-- not be able to tell whether another is paying.
create or replace view public.members_directory
with (security_invoker = false) as
  select id, full_name, first_name, avatar_initials, specialization,
         region, role, bio, created_at
  from public.profiles
  where status = 'active' and public.is_member();

grant select on public.members_directory to authenticated;
