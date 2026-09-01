-- ============================================================================
-- WhatsApp unanswered-message email (the owner, 1/9): an inbound WhatsApp
-- that nobody answered within 5 minutes emails שרה — and the team member who
-- OPENED the conversation, when it was team-initiated. Same grace pattern as
-- the chat emails; the cron stamps here.
-- ============================================================================

alter table public.wa_messages
  add column if not exists email_notified_at timestamptz;

create index if not exists wa_messages_email_grace_idx
  on public.wa_messages (created_at)
  where direction = 'in' and email_notified_at is null;
