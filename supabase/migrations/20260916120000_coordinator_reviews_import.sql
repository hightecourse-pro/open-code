-- Import-readiness + management round (the owner, 16/9):
-- 1. Reviews keyed by EMAIL for women not yet in the community — linked
--    automatically the moment she signs up.
-- 2. The imported rating phrasing is kept verbatim (talent/communication
--    labels) alongside the numeric scale.
-- 3. Per-institution "who manages the reviews" flag on the contact link.
-- 4. Per-contact portal-access toggle, free-text notes, and email becomes
--    optional (a contact without email simply cannot log in yet).

alter table public.institution_contacts alter column email drop not null;
alter table public.institution_contacts add column if not exists notes text;
alter table public.institution_contacts add column if not exists portal_enabled boolean not null default true;

alter table public.institution_contact_links add column if not exists manages_reviews boolean not null default true;

alter table public.coordinator_reviews alter column profile_id drop not null;
alter table public.coordinator_reviews add column if not exists graduate_email text;
alter table public.coordinator_reviews add column if not exists talent_label text;
alter table public.coordinator_reviews add column if not exists communication_label text;

-- Unlinked rows: one review per contact per graduate email.
create unique index if not exists coordinator_reviews_email_key
  on public.coordinator_reviews (contact_id, lower(graduate_email))
  where profile_id is null;

-- A review must point at someone — a profile or at least an email.
alter table public.coordinator_reviews drop constraint if exists coordinator_reviews_subject;
alter table public.coordinator_reviews add constraint coordinator_reviews_subject
  check (profile_id is not null or graduate_email is not null);
