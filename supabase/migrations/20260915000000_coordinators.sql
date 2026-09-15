-- ============================================================================
-- מוסדות לימודים — אנשי קשר (רכזות) ואזור אישי (the owner, 14/9 night task):
-- per-institution contact people, reachable by email from the admin, with an
-- OTP-only personal portal where a coordinator sees HER graduates (by year
-- and certificate), reviews them (communication/talent/note — visible only
-- to her and the team, never to colleagues), reports who found work, and
-- follows her institution's applications and hires.
-- All tables: RLS enabled with NO policies = service-role only; every access
-- goes through server code that scopes by the signed coordinator session.
-- ============================================================================

create table if not exists public.institution_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists institution_contacts_email_key
  on public.institution_contacts (lower(email));
alter table public.institution_contacts enable row level security;

-- One contact ↔ many institutions (the owner: "אותו איש קשר יכול להיות
-- מקושר לכמה מוסדות"). `institution` is the study_place option VALUE.
create table if not exists public.institution_contact_links (
  contact_id uuid not null references public.institution_contacts(id) on delete cascade,
  institution text not null,
  primary key (contact_id, institution)
);
alter table public.institution_contact_links enable row level security;

-- A coordinator's assessment of ONE graduate. Private to the writing contact
-- and the team — colleagues from the same institution never see it.
create table if not exists public.coordinator_reviews (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.institution_contacts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  communication smallint check (communication between 1 and 5),
  talent smallint check (talent between 1 and 5),
  note text,
  -- Her employment report: did the graduate find work, and where if known.
  found_job boolean,
  found_job_place text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contact_id, profile_id)
);
alter table public.coordinator_reviews enable row level security;

-- OTP codes for the coordinator portal login (hashed, short-lived).
create table if not exists public.coordinator_otp (
  email text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.coordinator_otp enable row level security;

-- Emails the team sent a contact from the system — the record on her card.
create table if not exists public.contact_emails (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.institution_contacts(id) on delete cascade,
  subject text,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.contact_emails enable row level security;
