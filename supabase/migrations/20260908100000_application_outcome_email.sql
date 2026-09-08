-- Per-application stamp for the end-of-review outcome email (the owner, 8/9):
-- the regret email to everyone not finally approved, or the "הגשנו אותך"
-- email to everyone forwarded to the employer. Set only after a successful
-- send, so a second click sends only to whoever is still missing.
alter table public.applications add column if not exists outcome_email_sent_at timestamptz;
