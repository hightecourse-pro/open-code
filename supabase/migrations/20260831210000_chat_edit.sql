-- ============================================================================
-- Chat message editing (the owner, 1/9: "צריך אפשרות לערוך בצ'אט") — the
-- sender may rewrite her own message within a 15-minute window (WhatsApp's
-- convention); edited_at marks it so the bubble says "נערכה". The write goes
-- through the server action (sender + window checked); members still have no
-- direct UPDATE policy on messages. Safe to re-run.
-- ============================================================================

alter table public.messages add column if not exists edited_at timestamptz;
