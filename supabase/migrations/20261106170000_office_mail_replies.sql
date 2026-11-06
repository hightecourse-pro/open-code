-- תיבת המיילים ממנה, round 2 (the owner, 6.11): ״תסמן מה לא נקרא ותאפשר לי לענות דרך המערכת;
-- אם היתה תשובה למייל שאראה אותה״. Outgoing mail of the mailbox is copied too (direction 'out'),
-- so a reply - sent from the app or from Gmail - shows under the message it answers (same thread);
-- Gmail's unread flag and the app's own ״נקרא״ stamp are kept; the RFC Message-ID lets a reply thread.
alter table public.office_mail
  add column if not exists direction text not null default 'in' check (direction in ('in', 'out')),
  add column if not exists unread boolean not null default false,
  add column if not exists rfc_message_id text,
  add column if not exists read_in_app_at timestamptz,
  add column if not exists sent_by uuid references public.profiles(id) on delete set null;

create index if not exists office_mail_thread_idx on public.office_mail (thread_id, sent_at);

-- Only incoming mail is linked to a member (our own outgoing rows stay unlinked).
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
   where x.direction = 'in' and x.profile_id is null and x.from_email is not null and lower(u.email) = lower(x.from_email);
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
   where x.direction = 'in' and x.profile_id is null and coalesce(trim(x.from_name), '') <> '' and lower(trim(x.from_name)) = p.nm;
  get diagnostics k = row_count;
  n := n + k;
  return n;
end;
$$;

revoke all on function public.office_mail_link() from public;
grant execute on function public.office_mail_link() to service_role;
