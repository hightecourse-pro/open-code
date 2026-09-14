-- The "שילמו וטרם נרשמו" cube counted charge ROWS, not women — a payer with
-- two monthly charges counted twice (the owner, 14/9: "המספרים בדשבורד לא
-- מסתדרים"). Count distinct emails instead. Safe to re-run.
create or replace function public.admin_unregistered_payers_count()
returns integer
language sql
stable security definer
set search_path to ''
as $$
  select case
    when public.is_admin() then (
      select count(distinct lower(ep.email))::int
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
