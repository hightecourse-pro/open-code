-- ============================================================================
-- Personal emails leave a record (the owner, 1/9: "צריכה לראות שכבר שלחתי
-- אליה, שלא נעשה את זה כפול, ולראות את תוכן המייל"). Every send — the member
-- file's 💌 card AND a mentor-decline note — stores who wrote what, when.
-- Admin-only. Safe to re-run.
-- ============================================================================

create table if not exists public.personal_emails (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  sender_id  uuid references public.profiles (id) on delete set null,
  /** What kind of note this was — 'personal' or 'mentor_decline'. */
  kind       text not null default 'personal',
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists personal_emails_profile_idx
  on public.personal_emails (profile_id, created_at desc);

alter table public.personal_emails enable row level security;
drop policy if exists "personal_emails_admin" on public.personal_emails;
create policy "personal_emails_admin" on public.personal_emails
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
