-- ============================================================================
-- Chat gets emoji reactions and quoting (the owner, 1/9: "כמקובל בצ'אטים").
-- reactions: one emoji per participant, keyed by profile id — {} when none.
-- reply_to_id: the quoted message; SET NULL keeps the reply if the original
-- is ever deleted. Writes go through server actions (participant-checked);
-- the RLS insert/select policies already scope by conversation membership.
-- Safe to re-run.
-- ============================================================================

alter table public.messages add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table public.messages add column if not exists reply_to_id uuid references public.messages (id) on delete set null;
