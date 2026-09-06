-- Forum posts get an explicit subject line (the owner, 6/9). Optional: posts
-- without one keep deriving their list title from the body's first line.
alter table public.posts add column if not exists title text;
