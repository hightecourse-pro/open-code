-- Sessions carry their own learning material (the owner, 2026-08-30):
-- * pre_topics — "נושאים שחשוב להכיר לפני הסשן", shown to members ONLY until
--   the session starts;
-- * the syllabus becomes an UPLOADED file (stored in the public
--   session-files bucket; syllabus_url keeps holding the resulting URL).
alter table public.sessions add column if not exists pre_topics text;

-- CV checker history (the owner): every AI review already lands in
-- cv_reviews — now it remembers WHICH saved document it ran on.
alter table public.cv_reviews add column if not exists cv_document_id uuid
  references public.cv_documents(id) on delete set null;

-- Public bucket for session files (syllabus / materials uploads) — same
-- pattern as article-images.
insert into storage.buckets (id, name, public)
values ('session-files', 'session-files', true)
on conflict (id) do nothing;

create policy "session files are public"
  on storage.objects for select
  using (bucket_id = 'session-files');
