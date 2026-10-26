-- Nedarim sends TWO callbacks for one standing-order setup a few ms apart (the
-- "הקמת הו"ק" transaction and the account-level KevaId webhook). Both ran
-- activateSubscription at the same time: each saw no row, inserted its own,
-- and then closed "every other live row" - the other one's. תהילה גולדשמידט
-- (26/10, 14:04) ended with two canceled rows and "המנוי לא פעיל כרגע" on
-- /subscription minutes after paying; 27 such pairs in the last 30 days, the
-- others were rescued by the charge callback that came an hour later.
--
-- The activation now runs in ONE transaction per member under an advisory
-- lock: the second callback waits for the first and updates its row instead
-- of racing it. The newest row wins (by period end), every other live row is
-- closed - and stamped as "ended mail handled", because a technical leftover
-- never was a membership that ended (21/10: חנה הופמן, Efrat Azani).
create or replace function public.activate_subscription_row(
  p_profile_id uuid,
  p_plan public.subscription_plan,
  p_provider_sub_id text,
  p_min_term_months int,
  p_setup_only boolean,
  p_grace_days int,
  p_period_months int
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_paid_until timestamptz;
  v_end timestamptz;
begin
  -- one activation at a time per member; released with the transaction
  perform pg_advisory_xact_lock(hashtext('subscription:' || p_profile_id::text));

  select id, current_period_end into v_id, v_paid_until
  from public.subscriptions
  where profile_id = p_profile_id
  order by current_period_end desc nulls last
  limit 1;

  if p_setup_only then
    -- a keva setup opens a short grace until the charge callback - never
    -- shorter than a period she already paid for (a card replaced mid-month
    -- keeps the month)
    v_end := now() + make_interval(days => p_grace_days);
    if v_paid_until is not null and v_paid_until > v_end then
      v_end := v_paid_until;
    end if;
  else
    v_end := now() + make_interval(months => p_period_months);
  end if;

  if v_id is not null then
    update public.subscriptions
       set plan = p_plan,
           status = 'active',
           provider_sub_id = coalesce(p_provider_sub_id, provider_sub_id),
           current_period_end = v_end,
           canceled_at = null
     where id = v_id;
  else
    insert into public.subscriptions
      (profile_id, plan, status, provider, provider_sub_id, min_term_months, current_period_end)
    values
      (p_profile_id, p_plan, 'active', 'nedarim', p_provider_sub_id, p_min_term_months, v_end)
    returning id into v_id;
  end if;

  -- one live subscription per member
  update public.subscriptions
     set status = 'canceled',
         canceled_at = now(),
         ended_email_sent_at = coalesce(ended_email_sent_at, now())
   where profile_id = p_profile_id
     and id <> v_id
     and status in ('active', 'trialing', 'past_due');

  return v_id;
end;
$$;

-- service role only: a member must never be able to activate herself
revoke all on function public.activate_subscription_row(uuid, public.subscription_plan, text, int, boolean, int, int) from public, anon, authenticated;
