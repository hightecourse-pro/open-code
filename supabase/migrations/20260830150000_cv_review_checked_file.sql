-- The CV checker keeps the exact file a direct-upload check ran on (the
-- owner, 30/8: "תשמור את הקובץ שעליו זה בוצע שניתן יהיה לראות").
-- Saved-document runs keep linking through cv_document_id; this path is the
-- snapshot for one-off uploads, stored in the cvs bucket under
-- {profile_id}/ai-checks/ so the member's own storage policy can sign it.
alter table public.cv_reviews
  add column if not exists checked_file_path text;
