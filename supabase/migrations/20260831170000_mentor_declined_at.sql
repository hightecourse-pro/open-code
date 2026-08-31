-- ============================================================================
-- Declined mentor applications leave a trace (the owner, 1/9: "כאלו שביקשו
-- להיות מנטוריות ודחיתי — צריכות להופיע איפשהו"): the decline stamps
-- mentor_declined_at, and ניהול מנטוריות lists them. Safe to re-run.
-- ============================================================================

alter table public.profiles add column if not exists mentor_declined_at timestamptz;
