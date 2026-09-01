-- ============================================================================
-- WhatsApp inbox (the owner, 31/8): the community's WhatsApp number lives on
-- Meta's Cloud API — no phone, no app — and the team reads and answers from
-- the admin. These tables are the conversation store; the webhook writes
-- inbound traffic, the admin screen writes outbound.
-- Team-only data: members never see it, RLS admits admins alone.
-- ============================================================================

create table if not exists public.wa_contacts (
  id              uuid primary key default gen_random_uuid(),
  -- The WhatsApp id — the phone in international digits (9725XXXXXXXX).
  wa_id           text not null unique,
  display_name    text,
  -- A community member whose profile phone matches — linked lazily, may be null.
  profile_id      uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz,
  -- The 24-hour service-window anchor: Meta allows free-form replies only
  -- within 24h of HER last inbound message.
  last_inbound_at timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.wa_messages (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references public.wa_contacts (id) on delete cascade,
  direction     text not null check (direction in ('in', 'out')),
  body          text not null,
  -- Meta's message id — idempotency for webhook redeliveries and the hook
  -- for delivery-status updates.
  wa_message_id text unique,
  status        text not null default 'received'
                check (status in ('received', 'sent', 'delivered', 'read', 'failed')),
  template_name text,
  error         text,
  -- Which admin sent it (outbound only).
  sent_by       uuid references public.profiles (id) on delete set null,
  raw           jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists wa_messages_contact_time_idx
  on public.wa_messages (contact_id, created_at desc);
create index if not exists wa_contacts_last_message_idx
  on public.wa_contacts (last_message_at desc);

alter table public.wa_contacts enable row level security;
alter table public.wa_messages enable row level security;

drop policy if exists wa_contacts_admin_all on public.wa_contacts;
create policy wa_contacts_admin_all on public.wa_contacts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists wa_messages_admin_all on public.wa_messages;
create policy wa_messages_admin_all on public.wa_messages
  for all using (public.is_admin()) with check (public.is_admin());
