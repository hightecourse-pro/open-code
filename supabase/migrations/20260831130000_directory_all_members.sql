-- ============================================================================
-- The members directory shows EVERYONE (the owner, 31/8): pending members
-- included, not only active ones — "במשתתפות שלנו אמורים לראות את כולן".
-- A new is_subscriber column marks who really pays: an activated paid junior,
-- a live subscription, or an email on the imported Nedarim payers list — so a
-- pending member who already paid shows up labeled מנויה.
-- (CREATE OR REPLACE may only APPEND columns — is_subscriber goes last.)
-- Safe to re-run.
-- ============================================================================

create or replace view public.members_directory
with (security_invoker = false) as
  select p.id, p.full_name, p.first_name, p.avatar_initials, p.specialization,
         p.region, p.role, p.bio, p.created_at,
         (
           p.role = 'junior' and (
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
