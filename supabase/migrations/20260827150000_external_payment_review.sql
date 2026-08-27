-- A payment that arrived from an UNRECOGNIZED caller (Nedarim rotates its
-- webhook IPs) is stored instead of dropped — but flagged: it must not
-- activate anyone until the admin confirms it against the Nedarim console.
alter table public.external_payments
  add column if not exists needs_review boolean not null default false;
