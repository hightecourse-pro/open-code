-- Course payment without a callback (the owner, 6/10): the clearing is
-- Shufra's Nedarim page (https://nedar.im/cSpv). Their page accepts URL
-- parameters, so every registrant goes there with:
--   Analytic = her registration code  -> printed in the payment's comment in
--              Shufra's Nedarim report (exact matching)
--   Redirect = our /masters-course/paid?r=<token> -> Nedarim sends her browser
--              back after a successful charge, and we mark "reported as paid".
alter table public.course_registrations add column if not exists reg_code text;
alter table public.course_registrations add column if not exists pay_token text;
alter table public.course_registrations add column if not exists payment_reported_at timestamptz;
create unique index if not exists course_registrations_pay_token_idx
  on public.course_registrations (pay_token) where pay_token is not null;
create unique index if not exists course_registrations_reg_code_idx
  on public.course_registrations (reg_code) where reg_code is not null;
