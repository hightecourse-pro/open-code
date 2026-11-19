-- הייטקורס 2026 - the pre-conference mail and the preparation questionnaire
-- (the owner, 19/11: ״אני רוצה שאתה תנהל את זה ותשלח״). One row per frontal
-- participant of the owner's sheet (״משתתפות״, every track but ״דיגיטלי״):
-- the snapshot the mail is built from, the mail's outcome, what the earlier
-- Google Form already knew (the prefill) and what she answers in our form.
-- The tick (every 30 minutes) adds newcomers, mails them and mirrors the
-- table into a tab of the owner's sheet. Team-only data: the service role
-- writes, the admin screen reads - no member policies.
create table if not exists public.hc_preconf_participants (
  id                uuid primary key default gen_random_uuid(),
  -- 'tz:<ת.ז.>' (or 'mail:<address>' when the sheet has no ת.ז.); samples are 'sample:<n>'.
  source_key        text not null unique,
  -- The link in her mail: /hightecourse-2026/prep/<token>.
  token             text not null unique default encode(gen_random_bytes(12), 'hex'),
  is_sample         boolean not null default false,
  sheet_row         integer,
  sheet_num         text,
  email             text not null,
  cc_email          text,
  id_number         text,
  first_name        text not null default '',
  last_name         text not null default '',
  -- The sheet's course text, the canonical course it maps to, and which questionnaire she gets
  -- (dev | ai | role | soft | mgmt | unknown).
  course_raw        text not null default '',
  course            text not null default '',
  course_kind       text not null default 'unknown',
  laptop_required   boolean not null default false,
  track             text,
  lodging           text,
  lodging_paid      text,
  private_room      text,
  private_room_paid text,
  baby              text,
  baby_lodging      text,
  baby_lodging_paid text,
  sitter_morning    text,
  sitter_morning_paid text,
  sitter_evening    text,
  sitter_evening_paid text,
  laptop_own        text,
  laptop_rental     text,
  laptop_rental_paid text,
  cert_course       text,
  role_sheet        text,
  office_sheet      text,
  company           text,
  -- ״עדכון״ = כן: the site's personal area wrote her changes back.
  updated_personal  boolean not null default false,
  -- Why no mail goes out (a course still to be chosen, a move awaiting the company) - null = free to send.
  hold_reason       text,
  -- null (not yet) | sent | blocked | error
  mail_status       text,
  mail_sent_at      timestamptz,
  mail_error        text,
  mail_attempts     integer not null default 0,
  -- What the earlier Google Form (״בחירת קורס פיתוח AI״) already holds for her, by mail.
  prefill           jsonb,
  -- Her answers in our questionnaire.
  answers           jsonb,
  answered_at       timestamptz,
  -- The sheet no longer lists her (a cancellation) - kept, not mailed.
  removed_at        timestamptz,
  first_seen_at     timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists hc_preconf_participants_mail_idx
  on public.hc_preconf_participants (mail_status, hold_reason, removed_at)
  where is_sample = false;

-- One row: the owner's switch and the last run.
create table if not exists public.hc_preconf_settings (
  id            integer primary key default 1 check (id = 1),
  enabled       boolean not null default false,
  running_since timestamptz,
  last_run_at   timestamptz,
  last_run      jsonb,
  updated_at    timestamptz not null default now()
);
insert into public.hc_preconf_settings (id) values (1) on conflict (id) do nothing;

alter table public.hc_preconf_participants enable row level security;
alter table public.hc_preconf_settings enable row level security;
