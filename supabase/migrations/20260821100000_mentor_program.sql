-- Mentor program + session reminders + subscription self-service groundwork.
--
-- 1. session_reminders — one row per (session, stage) actually sent, claimed
--    BEFORE sending so two overlapping cron runs can never double-mail.
-- 2. Mentor-scope questionnaire questions (workplace / years / tech /
--    "במה תרצי לתרום" — the last one's options are edited in admin config).
-- 3. pg_cron + pg_net extensions for the every-10-minutes reminder tick.
--    The cron.schedule() call itself is per-environment configuration (each
--    environment tick hits ITS OWN url with ITS OWN secret), applied via the
--    management API — deliberately not in this file, which must be identical
--    in both environments.

-- 1 ─ reminder log ------------------------------------------------------------
create table if not exists public.session_reminders (
  session_id uuid not null references public.sessions(id) on delete cascade,
  stage      text not null check (stage in ('morning', 't30', 'start')),
  sent_at    timestamptz not null default now(),
  recipients integer not null default 0,
  primary key (session_id, stage)
);

alter table public.session_reminders enable row level security;

-- Service role bypasses RLS; admins may inspect from the dashboard.
create policy "session_reminders_admin_select" on public.session_reminders
  for select using ( ( select public.is_admin() ) );

-- 2 ─ mentor questionnaire ----------------------------------------------------
insert into public.config_questions
  (key, label_he, scope, intake_track, field_type, required, active, employer_visible, sort_order, options, taxonomy_kind)
select v.key, v.label_he, 'mentor'::public.question_scope, 'both', v.field_type::public.field_type, v.required, true, false, v.sort_order, v.options, v.taxonomy_kind::public.taxonomy_kind
from (values
  ('mentor_workplace',    'איפה את עובדת היום?',                'text'::text,        true,  81, '[]'::jsonb, null::text),
  ('mentor_years',        'כמה שנות ניסיון יש לך בתעשייה?',      'number',            true,  82, '[]'::jsonb, null),
  ('mentor_tech',         'הטכנולוגיות שאת חזקה בהן',            'multiselect',       true,  83, '[]'::jsonb, 'tech'),
  ('mentor_contribution', 'במה תרצי לתרום לקהילה?',              'multiselect',       true,  84,
     '[{"value":"answers","label":"מענה לשאלות מקצועיות"},{"value":"mental","label":"ליווי מנטלי והתנהלות בעבודה חדשה"},{"value":"hackathon","label":"ליווי פרויקט בהאקתון"}]'::jsonb,
     null)
) as v(key, label_he, field_type, required, sort_order, options, taxonomy_kind)
where not exists (select 1 from public.config_questions q where q.key = v.key);

-- 3 ─ cron plumbing -----------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;
