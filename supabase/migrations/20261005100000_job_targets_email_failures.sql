-- Job-announcement emails (the owner, 5/10: "לא כולן קיבלו מייל"): the queue
-- drain used to stamp emailed_at even when Resend refused the send, so a
-- refused address silently never got the job. Failures are now recorded and
-- visible, rate-limit refusals are retried on the next run.
alter table public.job_targets add column if not exists email_failed_at timestamptz;
alter table public.job_targets add column if not exists email_error text;
create index if not exists job_targets_pending_email_idx
  on public.job_targets (created_at)
  where emailed_at is null and email_failed_at is null;
