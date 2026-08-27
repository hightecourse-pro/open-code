-- Technologies are grouped (the owner, 2026-08-27): each taxonomy row may
-- carry a group label; the admin adds groups and technologies inside them,
-- and the profile wizard shows the chips under group headings.
alter table public.config_taxonomies add column if not exists group_he text;
