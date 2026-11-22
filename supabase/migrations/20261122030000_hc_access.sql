-- ============================================================================
-- מערכת ניהול הייטקורס: an account may be let into /hightecourse without being
-- an Open Code admin (the owner, 22.11: ״תן לי ליהודית משתמש וסיסמה רק לדשבורד,
-- לא לאדמין של קוד פתוח״). hc_access is the only thing such an account has: its
-- role stays junior and its status pending - the community gate sends it to
-- /hightecourse, the admin gate (role = admin) never opens for it, and the
-- admins-only screens of the system (sheets, pre-conference mail) stay shut.
-- The guard trigger learns the column: a signed-in non-admin may edit her own
-- profile row and must not be able to grant herself this.
-- ============================================================================
alter table public.profiles add column if not exists hc_access boolean not null default false;
comment on column public.profiles.hc_access is 'May enter מערכת ניהול הייטקורס (/hightecourse: dashboard + participants) without the admin role; set by the team only.';

create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.member_tier := old.member_tier;
    new.hc_access := old.hc_access;
  end if;
  return new;
end;
$$;
