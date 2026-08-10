-- ============================================================================
-- קוד פתוח — ניהול משרות ולקוחות מקצה לקצה (CRM + פרסום ממוקד + צינור גיוס).
-- להרצה ב-SQL Editor. בטוח להרצה חוזרת.
--
-- זרימה: ליד ב-CRM → משרה בטיפול (מוקצים פרטי פורטל) → משרה מפורסמת לקהל
-- ממוקד → הגשות עם שאלות → סינון אדמין → הגשה ללקוח → ראיון/מבחן → גיוס 🎉
-- ============================================================================

-- ---------------------------------------------------------------- 1) CRM
-- הליד והלקוח הם אותה רשומה: portal_clients מלווה את הלקוח מהשיחה הראשונה.
-- username/password מוקצים רק כשהסטטוס מגיע ל"משרה בטיפול".
alter table public.portal_clients alter column username drop not null;

alter table public.portal_clients
  add column if not exists contact_name  text,
  add column if not exists contact_phone text,
  add column if not exists crm_status    text not null default 'initial_call'
    check (crm_status in ('initial_call','materials_sent','job_active','hired')),
  add column if not exists can_search    boolean not null default false,
  add column if not exists crm_notes     text;

-- לקוחות קיימים עם פרטי גישה — כבר "משרה בטיפול". הדיפולט החדש (רק מה
-- ששלחנו, בלי חיפוש חופשי) חל גם עליהם — can_search נשאר false.
update public.portal_clients
set crm_status = 'job_active'
where username is not null and crm_status = 'initial_call';

-- ---------------------------------------------------------------- 2) משרות
alter table public.jobs
  add column if not exists job_kind text not null default 'immediate'
    check (job_kind in ('immediate','practicum_placement','practicum_percent','practicum_free','other')),
  add column if not exists practicum_percent int
    check (practicum_percent is null or (practicum_percent between 1 and 100)),
  add column if not exists pipeline_status text not null default 'draft'
    check (pipeline_status in ('draft','published','candidates_sent','interviews','hired','closed_no_hire')),
  add column if not exists description_html text,
  add column if not exists published_at timestamptz;

-- משרות קיימות שכבר פתוחות לא נעלמות — נחשבות מפורסמות.
update public.jobs
set pipeline_status = 'published', published_at = coalesce(published_at, created_at)
where status = 'open' and pipeline_status = 'draft';

-- ------------------------------------------------- 3) קהל היעד של משרה
-- מי המשרה פורסמה אליה (לפי קריטריונים או סימון ידני). משרה שיש לה שורות
-- כאן גלויה בקהילה רק לחברות האלו.
create table if not exists public.job_targets (
  job_id     uuid not null references public.jobs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source     text not null default 'criteria' check (source in ('criteria','manual')),
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (job_id, profile_id)
);
create index if not exists job_targets_profile_idx on public.job_targets (profile_id);

alter table public.job_targets enable row level security;
drop policy if exists "job_targets_admin" on public.job_targets;
create policy "job_targets_admin" on public.job_targets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "job_targets_own_select" on public.job_targets;
create policy "job_targets_own_select" on public.job_targets
  for select to authenticated using (profile_id = (select auth.uid()));

-- משרה ממוקדת גלויה רק למי שבקהל היעד (או לאדמין); משרה בלי קהל יעד — לכולן.
drop policy if exists "jobs_select" on public.jobs;
create policy "jobs_select" on public.jobs for select to authenticated
  using (
    public.is_member() and (is_visible or public.is_admin())
    and (
      public.is_admin()
      or not exists (select 1 from public.job_targets t where t.job_id = id)
      or exists (select 1 from public.job_targets t
                 where t.job_id = id and t.profile_id = (select auth.uid()))
    )
  );

-- ------------------------------------------------- 4) שאלות חובה למשרה
-- השאלה הקבועה "למה את חושבת שאת מתאימה למשרה?" מובנית בקוד — כאן רק
-- השאלות שהאדמין מוסיפה לפי דרישות המשרה.
create table if not exists public.job_questions (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  question   text not null,
  sort_order int not null default 0,
  required   boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists job_questions_job_idx on public.job_questions (job_id, sort_order);

alter table public.job_questions enable row level security;
drop policy if exists "job_questions_admin" on public.job_questions;
create policy "job_questions_admin" on public.job_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "job_questions_member_select" on public.job_questions;
create policy "job_questions_member_select" on public.job_questions
  for select to authenticated using (public.is_member());

-- ------------------------------------------------------------ 5) הגשות
-- סטטוסים חדשים בצינור: sent (הוגשה ללקוח) / interview / exam / hired / declined.
alter type public.application_status add value if not exists 'sent';
alter type public.application_status add value if not exists 'interview';
alter type public.application_status add value if not exists 'exam';
alter type public.application_status add value if not exists 'hired';
alter type public.application_status add value if not exists 'declined';

alter table public.applications
  add column if not exists answers jsonb,               -- {question_id: answer, fit: "..."}
  add column if not exists admin_mark text
    check (admin_mark is null or admin_mark in ('optional','not_fit','approved')),
  add column if not exists sent_to_client_at timestamptz;

-- ------------------------------------- 6) משוב הלקוח על מועמדת למשרה
alter table public.job_candidates
  add column if not exists interview_marked boolean not null default false,
  add column if not exists client_note text;

-- --------------------------------------------------- 7) חגיגת מגויסות
alter table public.profiles
  add column if not exists found_job    boolean not null default false,
  add column if not exists workplace    text,
  add column if not exists hired_via_us boolean not null default false,
  add column if not exists hired_at     timestamptz;

-- ------------------------------------------- 8) ליווי מנטורית למגויסת
alter table public.mentor_requests
  add column if not exists kind text not null default 'general'
    check (kind in ('general','employment')),
  add column if not exists assigned_mentor_id uuid references public.profiles(id) on delete set null;

-- ---------------------------------------------- 9) סוגי תשובה לשאלות משרה
-- כמו גוגל פורם: פסקה / מספר / בחירה מרשימה / בחירה מרובה. לשאלות בחירה
-- options מחזיק את רשימת האפשרויות (מערך JSON של מחרוזות).
alter table public.job_questions
  add column if not exists answer_type text not null default 'paragraph'
    check (answer_type in ('paragraph','number','select','multiselect')),
  add column if not exists options jsonb;

-- --------------------------------------- 10) סיבת "לא רלוונטית" בסינון
-- כשהאדמין פוסלת מועמדת למשרה היא יכולה לרשום לעצמה למה (פנימי בלבד).
alter table public.applications
  add column if not exists admin_mark_reason text;

-- ------------------------------- 11) סטטוס "התקדמנו בינתיים" למועמדות
-- כששולחים מועמדות ללקוח, שאר המגישות מסומנות בעדינות (בלי מייל).
alter type public.application_status add value if not exists 'waitlisted';

-- ------------------------- 12) ללקוח מגיע רק מה שהוגש לו במפורש
-- צירוף מועמדת למשרה הוא שלב הכנה פנימי; היא מופיעה בפורטל הלקוח רק אחרי
-- "הגשה ללקוח" (sent_at נחתם בשליחה). אין מצב שמשהו אצל הלקוח ולא באדמין.
alter table public.job_candidates
  add column if not exists sent_at timestamptz;

-- משרות שכבר נשלחו דרך הזרימה (לפני העמודה) — נחשבות שנשלחו.
update public.job_candidates jc
set sent_at = now()
where jc.sent_at is null
  and exists (select 1 from public.jobs j
              where j.id = jc.job_id and j.pipeline_status in ('candidates_sent','interviews','hired'));
