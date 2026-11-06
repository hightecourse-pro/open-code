-- תיבת המיילים ממנה (the owner, 6.11): ״תכין לכל אחת בפרופיל … תיבת מיילים, כל המיילים שהגיעו ממנה
-- לתיבת המייל״ + ״תוסיף טיימר שכל כמה שעות מעדכן מיילים חדשים במערכת״. A copy of every message that
-- reached office@ (not our own outgoing mail), synced by /api/cron/office-mail every four hours and on
-- the admin's ״לרענן״, each linked to the member who wrote it - by her login address, else by her name
-- when it is unique. Service role only.
create table if not exists public.office_mail (
  id uuid primary key default gen_random_uuid(),
  gmail_id text not null unique,
  thread_id text,
  from_email text,
  from_name text,
  profile_id uuid references public.profiles(id) on delete set null,
  matched_by text check (matched_by in ('email', 'name')),
  subject text,
  snippet text,
  body text,
  sent_at timestamptz not null,
  synced_at timestamptz not null default now()
);

create index if not exists office_mail_profile_idx on public.office_mail (profile_id, sent_at desc);
create index if not exists office_mail_sent_idx on public.office_mail (sent_at desc);
create index if not exists office_mail_from_idx on public.office_mail (lower(from_email));

alter table public.office_mail enable row level security;
-- No policies on purpose: the service role (admin pages, the cron) is the only reader and writer.

-- Links unlinked mail to members: the sender's address against auth.users, then the sender's name
-- against profiles when exactly one member carries it. Returns how many rows were linked.
create or replace function public.office_mail_link()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n integer := 0;
  k integer;
begin
  update public.office_mail x
     set profile_id = u.id, matched_by = 'email'
    from auth.users u
   where x.profile_id is null and x.from_email is not null and lower(u.email) = lower(x.from_email);
  get diagnostics k = row_count;
  n := n + k;

  update public.office_mail x
     set profile_id = p.id, matched_by = 'name'
    from (
      select lower(trim(full_name)) nm, (array_agg(id))[1] id
        from public.profiles
       where coalesce(trim(full_name), '') <> ''
       group by lower(trim(full_name))
      having count(*) = 1
    ) p
   where x.profile_id is null and coalesce(trim(x.from_name), '') <> '' and lower(trim(x.from_name)) = p.nm;
  get diagnostics k = row_count;
  n := n + k;
  return n;
end;
$$;

revoke all on function public.office_mail_link() from public;
grant execute on function public.office_mail_link() to service_role;
