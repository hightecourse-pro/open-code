-- הייטקורס 2026 - the per-course update mail (the owner, 22/11: ״צריך לשלוח לכל
-- קורס עדכון על הכלים הנדרשים לקורס… נתחיל קורס קורס… כל מייל שכבר נשלח יישלח
-- לכל הרישומים לקורס זה מאוחר יותר״). One switch per course: once the owner
-- approved a course's text, every participant of that course gets the mail once,
-- and whoever registers later gets it from the next tick. The outcome per
-- participant sits beside the first mail's outcome.
alter table public.hc_preconf_participants
  add column if not exists update_mail_status   text,
  add column if not exists update_mail_sent_at  timestamptz,
  add column if not exists update_mail_error    text,
  add column if not exists update_mail_attempts integer not null default 0;

create table if not exists public.hc_preconf_course_updates (
  -- the canonical course name (config COURSES)
  course      text primary key,
  enabled     boolean not null default false,
  enabled_at  timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.hc_preconf_course_updates enable row level security;
