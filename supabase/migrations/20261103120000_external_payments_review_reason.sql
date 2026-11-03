-- Why an external payment waits for the admin instead of activating anyone:
--   unverified_caller - the webhook could not authenticate the caller (an unknown Nedarim IP)
--   not_membership    - the money is not membership money (a hackathon ticket, a course fee,
--                       a donation): neither the checkout's own קטגוריה nor a plan's price.
-- 29.10: a 20 ₪ hackathon payment (Groupe ״האקתון AI קוד פתוח 2026״, no Param1) matched a
-- member by email and opened her a monthly subscription (the owner, 3.11: ״באג - 20 ש"ח
-- מפעיל מנוי״). From now on only membership money may touch a subscription.
alter table public.external_payments
  add column if not exists review_reason text
  check (review_reason in ('unverified_caller', 'not_membership'));

update public.external_payments
   set review_reason = 'unverified_caller'
 where needs_review and review_reason is null;

-- Unclaimed rows that would have activated a subscription the day their payer signs up
-- (course fees of 500-2,400 ₪ were waiting in production): flag them by the same rule
-- the webhook applies now - the membership category, or exactly a plan's price.
update public.external_payments e
   set needs_review = true, review_reason = 'not_membership'
  from (
    select coalesce((select (value->>'monthlyAgorot')::int from public.app_settings where key = 'pricing'), 3900) as monthly,
           coalesce((select (value->>'annualDiscountPct')::numeric from public.app_settings where key = 'pricing'), 10) as pct
  ) pricing
 where e.claimed_at is null
   and e.review_reason is null
   and coalesce(e.raw->>'Groupe', '') <> 'דמי מנוי - קהילת קוד פתוח'
   and coalesce(e.amount_agorot, -1) not in (pricing.monthly, round(pricing.monthly * 12 * (1 - pricing.pct / 100))::int);
