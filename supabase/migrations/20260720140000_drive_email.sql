-- ============================================================================
-- Open Code — Gmail address for Drive sharing (run in the SQL Editor).
-- Safe to re-run.
--
-- Drive can only share with a Google account. A member who signed up with a
-- non-Google address gets an email asking for her Gmail; she fills it in on
-- her profile, and the sync worker then shares with that address instead.
-- `drive_email_requested_at` throttles the ask to once per member.
-- ============================================================================

alter table public.profiles add column if not exists drive_email text;
alter table public.profiles add column if not exists drive_email_requested_at timestamptz;

-- Which address a share was actually granted to. Without this, changing the
-- Gmail would orphan the old permission — we'd un-share the new address and
-- leave the old one with access forever.
alter table public.content_shares add column if not exists granted_email text;
