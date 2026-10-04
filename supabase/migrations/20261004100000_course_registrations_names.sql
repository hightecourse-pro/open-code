-- The course registration form asks first and last name separately (the
-- owner, 4/10). full_name stays as "first last" for every screen that reads it.
alter table public.course_registrations add column if not exists first_name text;
alter table public.course_registrations add column if not exists last_name text;
