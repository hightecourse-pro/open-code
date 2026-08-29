-- Public bucket for article images (2026-08-29): a pasted image arrives as a
-- data: URI, which the sanitizer rightly strips — the save flow now uploads
-- it here and swaps in the public URL. Writes go through the service role
-- only; the bucket being public is what serves the articles to members.
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true)
on conflict (id) do update set public = true;
