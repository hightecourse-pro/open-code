-- A session shared with ONE woman who is not a subscriber (the owner, 1/11:
-- ״תן לי אפשרות לשתף סשן ספציפי למישהי שלא מנויה״). The admin's manual share
-- (content_shares, granted_manually) already existed for sessions, but a free
-- member never saw the session open: the links policy, the free views and the
-- entitlement check all knew only ״paid״ and ״open to all״. Now a personal,
-- non-revoked share opens exactly that session to her: its recording links,
-- its zoom link and its materials. Membership (not rejected) stays the floor.

-- 1. The session's links are readable by the woman it was shared with.
drop policy if exists "content_links_select" on public.content_links;
create policy "content_links_select" on public.content_links for select to authenticated
  using (
    (select public.has_active_sub())
    or (
      (select public.is_member())
      and owner_type = 'session'
      and (
        exists (
          select 1 from public.sessions s
          where s.id = public.content_links.owner_id and s.open_to_all
        )
        or exists (
          select 1 from public.content_shares cs
          where cs.owner_type = 'session'
            and cs.owner_id = public.content_links.owner_id
            and cs.profile_id = (select auth.uid())
            and cs.granted_manually
            and cs.status <> 'revoked'
        )
      )
    )
  );

-- 2. The paid-only columns of the sessions shared with her personally:
--    the zoom link and the materials folder (the free view omits both).
create or replace view public.sessions_shared_with_me
with (security_invoker = false) as
  select s.id, s.zoom_url, s.materials_url
  from public.sessions s
  join public.content_shares cs
    on cs.owner_type = 'session' and cs.owner_id = s.id
  where cs.profile_id = (select auth.uid())
    and cs.granted_manually
    and cs.status <> 'revoked'
    and s.is_published
    and public.is_member();
grant select on public.sessions_shared_with_me to authenticated;

-- 3. A curated recording of such a session carries its video on the row itself.
create or replace view public.recordings_shared_with_me
with (security_invoker = false) as
  select r.id, r.session_id, r.video_url
  from public.recordings r
  join public.content_shares cs
    on cs.owner_type = 'session' and cs.owner_id = r.session_id
  where cs.profile_id = (select auth.uid())
    and cs.granted_manually
    and cs.status <> 'revoked'
    and public.is_member();
grant select on public.recordings_shared_with_me to authenticated;
