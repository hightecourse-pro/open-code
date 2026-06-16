-- ============================================================================
-- Fix: guard triggers must NOT restrict the service role / SQL editor.
-- They check is_admin() via auth.uid(); for server-side contexts auth.uid()
-- is null, which wrongly looked "non-admin" and blocked admin bootstrap and
-- webhook status updates. Now we only restrict a logged-in non-admin user.
-- Idempotent — safe to run on an already-applied database.
-- ============================================================================

create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.member_tier := old.member_tier;
  end if;
  return new;
end;
$$;

create or replace function public.guard_post_flags()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.is_official := false;
      new.is_pinned := false;
    else
      new.is_official := old.is_official;
      new.is_pinned := old.is_pinned;
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;
