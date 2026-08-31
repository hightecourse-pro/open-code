-- ============================================================================
-- Chat email grace (the owner, 1/9: "התראה למייל רק אם עברו 5 דקות ולא
-- עניתי"): the immediate per-message email is gone; the 10-minute cron mails
-- about messages that are ≥5 minutes old, still unread AND unanswered.
-- email_notified_at marks handled messages (sent OR deliberately skipped).
-- Safe to re-run.
-- ============================================================================

alter table public.messages add column if not exists email_notified_at timestamptz;

create index if not exists messages_email_pending_idx
  on public.messages (created_at)
  where read_at is null and email_notified_at is null;
