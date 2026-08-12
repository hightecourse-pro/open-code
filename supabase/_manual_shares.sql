-- ============================================================================
-- Open Code — manual (admin-granted) content shares. Run once in the SQL Editor.
--
-- Until now a member reached course material one way only: by opening a course
-- herself (one at a time, swappable monthly). This lets an admin hand a
-- specific member an EXTRA course/session — outside that model — and take it
-- back whenever she wants. The flag is what tells the two apart: automatic
-- shares follow her enrolment, manual ones stay until an admin removes them.
-- Safe to re-run.
-- ============================================================================

alter table public.content_shares
  add column if not exists granted_manually boolean not null default false;

-- The member's own view of "what was opened for me" reads these rows, so she
-- needs to see her own — never anyone else's.
do $$ begin
  create policy "members read their own shares"
    on public.content_shares for select to authenticated
    using (profile_id = auth.uid());
exception when duplicate_object then null; end $$;
