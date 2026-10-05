-- Hackathon 2026 (the owner, 5/10): subscribers register to a challenge -
-- alone or as a pair - and may switch; the team sees who is on what. Each
-- challenge has downloadable materials (subscribers only).
create table if not exists public.hackathon_registrations (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null unique references public.profiles (id) on delete cascade,
  challenge_key      text not null,
  -- Her pair partner (another subscriber), when she registered as a pair.
  partner_profile_id uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists hackathon_registrations_challenge_idx
  on public.hackathon_registrations (challenge_key, created_at);

create table if not exists public.hackathon_materials (
  id            uuid primary key default gen_random_uuid(),
  challenge_key text not null,
  title         text not null,
  -- Object path in the private "attachments" bucket (hackathon/<key>/<file>).
  file_path     text not null,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

create index if not exists hackathon_materials_challenge_idx
  on public.hackathon_materials (challenge_key, created_at);

-- Served through server actions / routes with the service role; the gate
-- (subscriber for members, admin for the team) lives in the app. No member
-- policies here on purpose.
alter table public.hackathon_registrations enable row level security;
alter table public.hackathon_materials enable row level security;
