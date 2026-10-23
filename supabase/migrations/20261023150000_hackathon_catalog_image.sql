-- The projects catalogue (the owner, 23/10): one picture per submitted project,
-- taken from a meaningful screen of the live system or its video, stored in a
-- folder of the hackathon shared drive and linked here for the printed and
-- digital catalogue.
alter table public.hackathon_submissions
  add column if not exists catalog_image_drive_id text,
  add column if not exists catalog_image_caption text;
