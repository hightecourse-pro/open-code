-- The Nedarim standing-orders registry, loaded from the owner's Nedarim
-- export (the owner, 14/9: "תאריך תחילה בנדרים צריך להיות מהאקסל") — the
-- keva report reads the authoritative start/end dates from here. Refreshed
-- by re-running the loader whenever the owner brings a new export.
-- RLS with no policies = service-role only, like site_thumbnails.
create table if not exists public.nedarim_kevas (
  keva_id text primary key,
  client_name text,
  email text,
  start_date date,
  end_date date,
  charges_limit text,
  amount_agorot integer,
  updated_at timestamptz not null default now()
);

alter table public.nedarim_kevas enable row level security;
