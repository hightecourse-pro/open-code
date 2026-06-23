-- ============================================================================
-- Open Code — Phase 4c: split member name into first + last (run in SQL Editor)
-- Safe to re-run. Keeps full_name (for display) composed from the two parts.
-- ============================================================================

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

-- Backfill existing rows: first word → first_name, the rest → last_name.
update public.profiles
set first_name = split_part(full_name, ' ', 1),
    last_name  = nullif(regexp_replace(full_name, '^\S+\s*', ''), '')
where first_name is null
  and full_name is not null
  and full_name <> '';
