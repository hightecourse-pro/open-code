-- ============================================================================
-- Open Code — daily digest preference per member (run in the SQL Editor).
-- 'daily' = every day (default) · 'unread' = only when there are new messages ·
-- 'off' = don't send. Safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists digest_frequency text not null default 'daily';
