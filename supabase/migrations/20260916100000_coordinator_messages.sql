-- צ'אט רכזות ↔ צוות (the owner, 16/9): "הן יכולות לשלוח הודעות ולהתכתב עם
-- האדמין בכל עת - תהיה חתימה לתשובה של מי מהצוות ענתה". Also carries job
-- recommendations ("משרה שעדיין לא הגשנו מועמדות - אפשרות לשלוח לנו המלצה").
-- RLS with no policies = service-role only; access goes through server code
-- scoped by the signed coordinator session / admin role.
create table if not exists public.coordinator_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.institution_contacts(id) on delete cascade,
  sender text not null check (sender in ('coordinator', 'team')),
  body text not null,
  -- The signature the owner asked for: which team member answered.
  team_author_name text,
  -- Set when the OTHER side has seen it (admin opens the thread / she opens the chat).
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists coordinator_messages_contact_idx
  on public.coordinator_messages (contact_id, created_at);
alter table public.coordinator_messages enable row level security;
