-- Pair registration needs the partner's consent (the owner, 5/10): the
-- invited member gets an email, logs in and confirms. Until then the inviter
-- and the team see "ממתין לאישור". Null = pending (when partner_profile_id is
-- set), a timestamp = confirmed.
alter table public.hackathon_registrations add column if not exists partner_confirmed_at timestamptz;
