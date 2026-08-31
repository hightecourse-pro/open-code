-- ============================================================================
-- An UNAPPROVED mentor carries no mentor indication (the owner, 1/9): until
-- the team approves her application she reads as a regular member everywhere
-- the community looks — the directory masks her role. The chat/write rules
-- lean on the same view: writable = team, approved mentor, or real subscriber.
-- Safe to re-run.
-- ============================================================================

create or replace view public.members_directory
with (security_invoker = false) as
  select p.id, p.full_name, p.first_name, p.avatar_initials, p.specialization,
         p.region,
         case when p.role = 'mentor' and p.status <> 'active'
              then 'junior'::public.user_role
              else p.role end as role,
         p.bio, p.created_at,
         (
           -- masked-role junior: a paying mentor APPLICANT counts as מנויה too
           (p.role = 'junior' or (p.role = 'mentor' and p.status <> 'active')) and (
             (p.status = 'active' and p.member_tier = 'paid')
             or exists (select 1 from public.subscriptions s
                        where s.profile_id = p.id and s.status in ('active', 'trialing'))
             or exists (select 1 from public.external_payments ep
                        join auth.users u on lower(u.email) = lower(ep.email)
                        where u.id = p.id and not ep.needs_review)
           )
         ) as is_subscriber
  from public.profiles p
  where p.status in ('active', 'pending') and not p.is_hidden and public.is_member();
