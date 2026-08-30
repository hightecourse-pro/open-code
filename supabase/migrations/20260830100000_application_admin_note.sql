-- Per-application internal note (the owner, 2026-08-30): "עמודה לכתוב הערה
-- ספציפית שתהיה מקושרת לבת במשרה זו" — the note belongs to the (member, job)
-- pair, i.e. the application, unlike the member-wide member_crm note.
--
-- A separate ADMIN-ONLY table rather than a column on applications: members
-- read their own application rows under RLS, and a note the team writes about
-- a candidate must never ride along on a select("*") from the member UI.
create table if not exists public.application_notes (
  application_id uuid primary key references public.applications(id) on delete cascade,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.application_notes enable row level security;

create policy application_notes_admin on public.application_notes
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
