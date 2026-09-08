-- ============================================================================
-- Supabase security advisory auth_users_exposed (email, 8/9): the directory
-- view referenced auth.users directly (for the external-payments email match)
-- while being selectable by anon/authenticated. No emails were ever in its
-- output and is_member() gates every row — but the reference itself is the
-- flagged pattern. The email lookup moves into a security-definer function,
-- the view stops touching auth.users, and the grants shrink to what the
-- directory actually needs (SELECT for signed-in members; nothing for anon).
-- Safe to re-run.
-- ============================================================================

create or replace function public.profile_has_external_payment(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.external_payments ep
    join auth.users u on lower(u.email::text) = lower(ep.email)
    where u.id = pid and not ep.needs_review
  );
$$;

revoke all on function public.profile_has_external_payment(uuid) from public;
grant execute on function public.profile_has_external_payment(uuid) to authenticated, service_role;

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
             or public.profile_has_external_payment(p.id)
           )
         ) as is_subscriber
  from public.profiles p
  where p.status in ('active', 'pending') and not p.is_hidden and public.is_member();

-- The directory is for signed-in members only, and it is read-only.
revoke all on public.members_directory from anon;
revoke all on public.members_directory from authenticated;
grant select on public.members_directory to authenticated;
