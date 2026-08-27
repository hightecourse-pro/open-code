-- Articles can now carry their own rich content (WordPress-style authoring)
-- instead of only linking out; edited_at tracks admin edits.
alter table public.articles add column if not exists body_html text;
alter table public.articles add column if not exists updated_at timestamptz;
