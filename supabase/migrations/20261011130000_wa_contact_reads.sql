-- WhatsApp "new message" per team member (the owner, 11/10): the badge counts
-- the PEOPLE who wrote and whom I have not looked at yet, the contact row says
-- "חדש" for me, and once I opened the conversation it is read for me only -
-- a teammate who has not seen it still sees the indication.
create table if not exists public.wa_contact_reads (
  contact_id  uuid not null references public.wa_contacts (id) on delete cascade,
  admin_id    uuid not null references public.profiles (id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (contact_id, admin_id)
);

-- Service role only (written when an admin opens a conversation).
alter table public.wa_contact_reads enable row level security;
