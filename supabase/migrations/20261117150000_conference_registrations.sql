-- Hightecourse 2026, the third day (Thursday 26.11.2026, ט״ז בכסלו) - public
-- registration outside the community (the owner, 17/11: ״תייצר לי דף מחוץ
-- לקהילה… מטרת הדף היא רישום לכנס ליום השלישי של הייטקורס״). One order per
-- submission - a single participant (650 ₪) or a group (500 ₪ each from the
-- fourth participant) with its contact and invoice details - and one row per
-- participant. Every completed registration is also appended to the owner's
-- Google Sheet (״רישום ליום השלישי״) and shown in the admin.
create table if not exists public.conference_orders (
  id                uuid primary key default gen_random_uuid(),
  event_key         text not null default 'hightecourse-2026-day3',
  -- "HC-7K3F9Q": read over the phone, planted in the Nedarim payment comment.
  short_code        text not null unique,
  -- Her way back from the payment page / to the thank-you page.
  pay_token         text not null unique,
  kind              text not null check (kind in ('single', 'group')),
  -- Group details (the contact fills them once; a single order leaves them empty).
  company           text,
  contact_name      text,
  contact_email     text,
  invoice_name      text,
  company_id        text,
  payment_method    text not null check (payment_method in ('credit', 'transfer')),
  note              text,
  participant_count integer not null default 1,
  unit_price_nis    integer not null,
  amount_nis        integer not null,
  -- pending (credit, not paid yet) | paid_reported (the browser saw the charge,
  -- the callback has not arrived) | paid | awaiting_transfer | canceled
  status            text not null default 'pending',
  paid_at           timestamptz,
  payment_reported_at timestamptz,
  nedarim_transaction_id text,
  payment_amount_agorot integer,
  confirmation_email_sent_at timestamptz,
  -- The Google Sheet: when the participants were appended, or why they were not.
  sheet_synced_at   timestamptz,
  sheet_error       text,
  admin_note        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists conference_orders_created_idx
  on public.conference_orders (event_key, created_at desc);

create table if not exists public.conference_participants (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.conference_orders (id) on delete cascade,
  seq             integer not null default 1,
  national_id     text not null,
  first_name      text not null,
  last_name       text not null,
  personal_email  text not null,
  work_email      text,
  phone           text not null,
  role_title      text,
  department      text,
  -- A single participant's company; a group's rows carry the order's company.
  company         text,
  -- The 1-based row in the Google Sheet, once appended (so a later status change can touch it).
  sheet_row       integer,
  created_at      timestamptz not null default now()
);

create index if not exists conference_participants_order_idx
  on public.conference_participants (order_id);

-- Team-only data: written by the public form through the service role, read
-- and edited by the admin screen the same way. No member policies.
alter table public.conference_orders enable row level security;
alter table public.conference_participants enable row level security;
