-- Send-once stamps for the subscription-lifecycle emails (the owner, 10/9):
-- the "מסתיים בעוד יומיים" reminder and the "הסתיים" notice each go out
-- exactly once, and a send blocked by Shabbat/chag simply happens on the next
-- eligible daily run.
alter table public.subscriptions add column if not exists ending_reminder_sent_at timestamptz;
alter table public.subscriptions add column if not exists ended_email_sent_at timestamptz;
