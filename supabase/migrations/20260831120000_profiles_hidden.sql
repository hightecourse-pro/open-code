-- ============================================================================
-- Hidden profiles (the owner, 31/8): a team test/preview account that stays
-- fully ACTIVE for its own login but is invisible to the other members —
-- it leaves the members directory (and everything built on the view).
-- The employer portal and the chat search filter on the same flag in code.
-- Safe to re-run.
-- ============================================================================

alter table public.profiles add column if not exists is_hidden boolean not null default false;

-- Same column list as 20260816160000 — CREATE OR REPLACE cannot reorder.
create or replace view public.members_directory
with (security_invoker = false) as
  select id, full_name, first_name, avatar_initials, specialization,
         region, role, bio, created_at
  from public.profiles
  where status = 'active' and not is_hidden and public.is_member();
