-- ============================================================================
-- Open Code — portal client passwords the admin can re-read. Run in the SQL
-- Editor. Safe to re-run.
--
-- The admin hands these credentials to the client, so she has to be able to
-- see the password again later — a one-way hash makes that impossible. We
-- store it AES-encrypted instead (same key as the AI-key vault), so the
-- clients screen can decrypt and show it on demand. The table is admin-only,
-- and the passwords are short auto-generated ones that unlock nothing beyond
-- the already privacy-filtered candidate profiles.
-- ============================================================================

alter table public.portal_clients add column if not exists password_enc text;

-- The old hash columns become optional (new clients use password_enc).
alter table public.portal_clients alter column password_hash drop not null;
alter table public.portal_clients alter column password_salt drop not null;
