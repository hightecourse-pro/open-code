-- Unsubscribe + leave (the owner, 18/10): every mail carries an "הסרה" link to a
-- page where she can stop our mails or leave the community altogether, with a
-- reason; the team sees who and why. A member who left keeps her row (status
-- 'left') so the team can act on her subscription and bring her back.
alter type public.profile_status add value if not exists 'left';

alter table public.profiles
  add column if not exists left_at timestamptz,
  add column if not exists left_reason text,
  add column if not exists left_from_status text;

-- One row per address that asked not to hear from us (members and non-members
-- alike - coordinators, employers). kind 'left' = she left the community.
create table if not exists public.email_opt_outs (
  email text primary key,
  kind text not null default 'emails' check (kind in ('emails', 'left')),
  reason text,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.email_opt_outs enable row level security;
create policy "email_opt_outs_admin" on public.email_opt_outs
  for all using (public.is_admin()) with check (public.is_admin());
