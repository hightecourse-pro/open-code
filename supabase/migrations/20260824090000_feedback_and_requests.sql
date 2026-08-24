-- PM round 2026-08-24: session feedback, member→team requests, and the
-- "איזה משרות אפשר להציע לך" profile question.

-- 1 ─ session feedback -------------------------------------------------------
-- For a week after a session ends every member is asked "היית איתנו?"; both
-- answers land here (attended=false just closes the ask), the ratings only
-- with a yes. One row per (session, member).
create table if not exists public.session_feedback (
  session_id      uuid not null references public.sessions(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  attended        boolean not null,
  content_rating  smallint check (content_rating between 1 and 5),
  practical_rating smallint check (practical_rating between 1 and 5),
  clarity_rating  smallint check (clarity_rating between 1 and 5),
  speaker_rating  smallint check (speaker_rating between 1 and 5),
  comment         text,
  created_at      timestamptz not null default now(),
  primary key (session_id, profile_id)
);

alter table public.session_feedback enable row level security;

create policy "session_feedback_own_insert" on public.session_feedback
  for insert with check ( profile_id = ( select auth.uid() ) );
create policy "session_feedback_own_select" on public.session_feedback
  for select using ( profile_id = ( select auth.uid() ) or ( select public.is_admin() ) );

-- 2 ─ member requests --------------------------------------------------------
-- The floating "יש לך בקשה?" widget. Admin replies land in the member's chat;
-- the row tracks the lifecycle for the admin screen + alerts center.
create table if not exists public.member_requests (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  subject     text not null,
  body        text not null,
  status      text not null default 'open' check (status in ('open', 'handled')),
  handled_at  timestamptz,
  handled_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists member_requests_status_idx on public.member_requests (status, created_at desc);

alter table public.member_requests enable row level security;

create policy "member_requests_own_insert" on public.member_requests
  for insert with check ( profile_id = ( select auth.uid() ) );
create policy "member_requests_own_select" on public.member_requests
  for select using ( profile_id = ( select auth.uid() ) or ( select public.is_admin() ) );
create policy "member_requests_admin_update" on public.member_requests
  for update using ( ( select public.is_admin() ) );

-- 3 ─ the offerable-roles question (options editable in admin config) --------
insert into public.config_questions
  (key, label_he, scope, intake_track, field_type, required, active, employer_visible, sort_order, options, taxonomy_kind)
select
  'job_offer_types',
  'איזה משרות אפשר להציע לך?',
  'junior'::public.question_scope,
  'both',
  'multiselect'::public.field_type,
  true, true, true, 45,
  '[{"value":"dev","label":"פיתוח"},{"value":"qa","label":"בדיקות"},{"value":"devops","label":"DevOps"},{"value":"implementation","label":"יישום"},{"value":"automation","label":"פיתוח אוטומציה"}]'::jsonb,
  null
where not exists (select 1 from public.config_questions q where q.key = 'job_offer_types');
