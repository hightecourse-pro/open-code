-- ============================================================================
-- Open Code — the workplace name stops being readable by the whole community.
-- Run once in the SQL Editor. Safe to re-run.
--
-- The spec promises: "מקום העבודה גלוי רק לה ולצוות — לעולם לא לחברות אחרות".
-- profiles.workplace could not keep that promise: profiles_select is open to
-- every member and RLS cannot hide a single column, so anyone could read it
-- through the REST API — and for an internal job that value is the CLIENT
-- COMPANY NAME, which rule 1 says is never exposed.
--
-- The fix is the one already used for drive_email: move the field to
-- member_private (admin/service-role only). found_job and hired_at stay on
-- profiles on purpose — the celebration banner is public by design, names only.
-- ============================================================================

alter table public.member_private add column if not exists workplace text;

-- Carry over what's already recorded, then remove the exposed column.
insert into public.member_private (profile_id, workplace)
select id, workplace from public.profiles where workplace is not null
on conflict (profile_id) do update set workplace = excluded.workplace;

alter table public.profiles drop column if exists workplace;
