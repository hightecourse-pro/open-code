-- Payments made OUTSIDE the app (a direct Nedarim link, a manual charge):
-- the webhook arrives with no Param1, so there is no profile to activate.
-- The payment is remembered here by the payer's identity; when a member with
-- that email exists (or later signs up), it is claimed and her membership
-- activates — the owner's "אם היא תיכנס נדע שהיא שילמה".
create table if not exists public.external_payments (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  phone               text,
  zeout               text,
  client_name         text,
  provider_payment_id text not null unique,
  amount_agorot       integer,
  plan                text not null default 'monthly',
  raw                 jsonb,
  claimed_by          uuid references public.profiles(id) on delete set null,
  claimed_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists external_payments_email_idx
  on public.external_payments (lower(email)) where claimed_at is null;

alter table public.external_payments enable row level security;

-- Service role writes; admins may inspect.
create policy "external_payments_admin_select" on public.external_payments
  for select using ( ( select public.is_admin() ) );
