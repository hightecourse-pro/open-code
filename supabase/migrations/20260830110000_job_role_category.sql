-- The member board filters by ROLE (the owner, 2026-08-30): פיתוח / בדיקות /
-- יישום / ניתוח מערכות … — a first-class column the admin sets per job,
-- replacing the retired employment-scope filter on the member side.
alter table public.jobs add column if not exists role_category text;
