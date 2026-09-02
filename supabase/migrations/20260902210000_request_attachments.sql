-- ============================================================================
-- Screenshots on member requests (the owner, 2/9): the request widget gains
-- the attachment picker (paste included) — a new 'request' context. Members
-- read their own rows; admins read everything (existing policy arms).
-- ============================================================================

alter table public.attachments drop constraint if exists attachments_context_check;
alter table public.attachments
  add constraint attachments_context_check
  check (context in ('post', 'comment', 'message', 'request'));
