-- ============================================================================
-- Open Code — session cancellation (run in the SQL Editor). Safe to re-run.
-- A canceled session shows "בוטל" and auto-hides from members 24h later; admin
-- can also delete immediately. canceled_at marks when it was canceled.
-- ============================================================================

alter table public.sessions
  add column if not exists canceled_at timestamptz;
