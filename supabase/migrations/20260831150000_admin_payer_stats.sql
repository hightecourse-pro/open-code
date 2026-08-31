-- ============================================================================
-- Dashboard counter (the owner, 1/9): paying women who have NOT signed up yet
-- — rows on the imported/collected external payments list with no matching
-- auth account. Counting needs an auth.users email match, so it lives in a
-- definer function; admins only. Safe to re-run.
-- ============================================================================

create or replace function public.admin_unregistered_payers_count()
returns integer
language sql security definer stable set search_path = '' as $$
  select case
    when public.is_admin() then (
      select count(*)::int
      from public.external_payments ep
      where ep.claimed_at is null
        and not ep.needs_review
        and ep.email is not null
        and not exists (
          select 1 from auth.users u where lower(u.email) = lower(ep.email)
        )
    )
    else null
  end;
$$;

grant execute on function public.admin_unregistered_payers_count() to authenticated;
