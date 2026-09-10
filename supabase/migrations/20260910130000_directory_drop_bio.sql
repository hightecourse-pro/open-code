-- ============================================================================
-- קצת על עצמי is for the management and the employer-facing candidate profile
-- only — never for other members (the owner, 10/9: "זה אמור להיות חשוף רק
-- לניהול"). The column sat in the directory view from the start but was
-- invisible until the 9/9 bio backfill filled profiles.bio for everyone; the
-- moment it had content, every member card showed it. Removing it from the
-- view (not just the UI) means no member-scoped query can read it at all.
-- DROP + CREATE because `create or replace view` cannot drop a column.
-- ============================================================================

drop view public.members_directory;

create view public.members_directory
with (security_invoker = false) as
  select p.id, p.full_name, p.first_name, p.avatar_initials, p.specialization,
         p.region,
         case when p.role = 'mentor' and p.status <> 'active'
              then 'junior'::public.user_role
              else p.role end as role,
         p.created_at,
         (
           -- masked-role junior: a paying mentor APPLICANT counts as מנויה too
           (p.role = 'junior' or (p.role = 'mentor' and p.status <> 'active')) and (
             (p.status = 'active' and p.member_tier = 'paid')
             or exists (select 1 from public.subscriptions s
                        where s.profile_id = p.id and s.status in ('active', 'trialing'))
             or public.profile_has_external_payment(p.id)
           )
         ) as is_subscriber
  from public.profiles p
  where p.status in ('active', 'pending') and not p.is_hidden and public.is_member();

-- Grants do not survive DROP — re-apply: signed-in members read, nobody else.
revoke all on public.members_directory from anon;
revoke all on public.members_directory from authenticated;
grant select on public.members_directory to authenticated;
