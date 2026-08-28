-- A per-job internal note for the team reviewing applicants (Shira:
-- "הערה שלנו ספציפית למשרה הזאת עבור בנות שהגישו") — admin-only surface.
alter table public.jobs add column if not exists team_note text;
