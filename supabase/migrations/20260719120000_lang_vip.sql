-- ============================================================================
-- Open Code — language skills + admin-only CRM (run in the SQL Editor).
-- Safe to re-run. What this does and why:
--
-- 1. member_crm — a NEW admin-only table for the VIP star, its reason, and
--    the internal screening notes. These used to live on `profiles`, whose
--    read policy allows every active member — meaning any member could read
--    every VIP flag and internal note through the Supabase REST API. The new
--    table is readable/writable by admins only; existing data is copied over
--    and then blanked on `profiles` to close the leak.
--
-- 2. Tightens profile_answers reads to owner-or-admin (was: any active
--    member could read everyone's answers — including ID numbers and phones).
--    The app itself only ever reads one's own answers + admin screens.
--
-- 3. Seeds the "שליטה בשפות" profile question (a language × level matrix,
--    special-cased by key in the app).
-- ============================================================================

-- 1. Admin-only CRM table --------------------------------------------------
create table if not exists public.member_crm (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  is_vip boolean not null default false,
  vip_reason text,
  internal_notes text,
  updated_at timestamptz not null default now()
);

alter table public.member_crm enable row level security;

drop policy if exists "member_crm_admin_only" on public.member_crm;
create policy "member_crm_admin_only" on public.member_crm
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Copy the CRM data that currently sits (exposed) on profiles…
insert into public.member_crm (profile_id, is_vip, internal_notes)
select id, is_vip, internal_notes
from public.profiles
where is_vip = true or internal_notes is not null
on conflict (profile_id) do nothing;

-- …and blank it there so members can no longer read it. (The columns stay,
-- deprecated and empty, so older code keeps working.)
update public.profiles
set is_vip = false, internal_notes = null
where is_vip = true or internal_notes is not null;

-- 2. profile_answers: owner or admin only ----------------------------------
drop policy if exists "profile_answers_select" on public.profile_answers;
create policy "profile_answers_select" on public.profile_answers
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

-- 3. Language-skills question ----------------------------------------------
insert into public.config_questions (key, label_he, field_type, required, sort_order, scope, intake_track, options) values
  ('language_skills', 'שליטה בשפות', 'multiselect', false, 18, 'all', 'both', '[]'::jsonb)
on conflict (key) do nothing;
