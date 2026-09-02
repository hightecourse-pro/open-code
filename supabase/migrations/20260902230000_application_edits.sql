-- ============================================================================
-- Editable applications (the members' ask, 2/9): until the team locks an
-- application (sent to the client / status advanced), the member may edit her
-- answers, swap the CV, or withdraw. Every edit snapshots the outgoing
-- version so the team can see what changed.
-- ============================================================================

alter table public.applications
  add column if not exists edited_at timestamptz,
  add column if not exists previous_versions jsonb not null default '[]'::jsonb;
