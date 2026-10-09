-- Course payments through Shufra's Nedarim CallBack (the owner, 9/10): their
-- account can call our webhook after every charge, but it carries ALL of
-- Shufra's payments - "במערכת יש המון תשלומים שלא קשורים אלינו - תצטרך להפריד".
-- Every callback that looks like a course payment is written here (one row
-- per Nedarim transaction), matched to a registration by the registration
-- code in the payment comment or by email; the rest are ignored.
create table if not exists public.course_payments (
  id               uuid primary key default gen_random_uuid(),
  course_key       text not null default 'masters-2026',
  registration_id  uuid references public.course_registrations (id) on delete set null,
  -- Nedarim's TransactionId (or keva-<KevaId>); a replayed callback is a no-op.
  transaction_id   text not null unique,
  amount_agorot    integer,
  installments     integer,
  first_installment_agorot integer,
  client_name      text,
  email            text,
  phone            text,
  groupe           text,
  comments         text,
  -- reg_code | email | manual - how the row found its registration.
  matched_by       text,
  -- ok | failed (a Status:Error report that named a registrant).
  status           text not null default 'ok',
  raw              jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists course_payments_registration_idx
  on public.course_payments (registration_id);
create index if not exists course_payments_created_idx
  on public.course_payments (course_key, created_at desc);

-- Team-only, service role only (same as course_registrations).
alter table public.course_payments enable row level security;

-- The registration carries a summary of her payment, and remembers whether
-- the confirmation mail already went out (the callback and the browser
-- redirect can both arrive - she gets one mail).
alter table public.course_registrations add column if not exists payment_amount_agorot integer;
alter table public.course_registrations add column if not exists payment_installments integer;
alter table public.course_registrations add column if not exists nedarim_transaction_id text;
alter table public.course_registrations add column if not exists confirmation_email_sent_at timestamptz;
