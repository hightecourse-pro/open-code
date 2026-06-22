-- ============================================================================
-- Open Code — Phase 4 bundle (run once in the Supabase SQL Editor)
-- Safe to re-run: enums/tables/policies are guarded, and the demo-data cleanup
-- only fires while no real content links exist yet.
--
-- Adds: admin CRM (VIP + notes + first-login gate), CV documents + 'cvs' bucket,
-- course/session Drive content links, per-member share tracking, course
-- ratings/views/feedback, and the full member intake profile questions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles: CRM + onboarding gate
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_vip boolean not null default false,
  add column if not exists internal_notes text,
  add column if not exists profile_completed boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. enums (guarded)
-- ---------------------------------------------------------------------------
do $$ begin create type public.cv_language as enum ('he', 'en', 'job'); exception when duplicate_object then null; end $$;
do $$ begin create type public.content_owner as enum ('course', 'session'); exception when duplicate_object then null; end $$;
do $$ begin create type public.link_kind as enum ('video', 'materials'); exception when duplicate_object then null; end $$;
do $$ begin create type public.share_status as enum ('pending', 'shared', 'revoked'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 3. tables
-- ---------------------------------------------------------------------------
create table if not exists public.cv_documents (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  label       text not null,
  language    public.cv_language not null default 'he',
  file_path   text not null,
  file_name   text,
  created_at  timestamptz not null default now()
);
create index if not exists cv_documents_owner_idx on public.cv_documents (profile_id, created_at desc);

create table if not exists public.content_links (
  id          uuid primary key default gen_random_uuid(),
  owner_type  public.content_owner not null,
  owner_id    uuid not null,
  kind        public.link_kind not null default 'video',
  title       text not null,
  url         text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists content_links_owner_idx on public.content_links (owner_type, owner_id, sort_order);

create table if not exists public.content_shares (
  id          uuid primary key default gen_random_uuid(),
  owner_type  public.content_owner not null,
  owner_id    uuid not null,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  status      public.share_status not null default 'pending',
  created_at  timestamptz not null default now(),
  shared_at   timestamptz,
  revoked_at  timestamptz,
  unique (owner_type, owner_id, profile_id)
);
create index if not exists content_shares_member_idx on public.content_shares (profile_id, status);
create index if not exists content_shares_pending_idx on public.content_shares (status) where status <> 'shared';

create table if not exists public.content_views (
  id         uuid primary key default gen_random_uuid(),
  link_id    uuid not null references public.content_links (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists content_views_link_idx on public.content_views (link_id);
create index if not exists content_views_member_idx on public.content_views (profile_id);

-- enrollments: studied flag + rating + feedback
alter table public.enrollments
  add column if not exists studied boolean not null default false,
  add column if not exists rating int,
  add column if not exists feedback text;

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.cv_documents enable row level security;
alter table public.content_links enable row level security;
alter table public.content_shares enable row level security;
alter table public.content_views enable row level security;

drop policy if exists "cv_documents_owner" on public.cv_documents;
create policy "cv_documents_owner" on public.cv_documents for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()));

drop policy if exists "content_links_select" on public.content_links;
create policy "content_links_select" on public.content_links for select to authenticated
  using (public.has_active_sub());
drop policy if exists "content_links_admin_write" on public.content_links;
create policy "content_links_admin_write" on public.content_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "content_shares_select" on public.content_shares;
create policy "content_shares_select" on public.content_shares for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
drop policy if exists "content_shares_admin_write" on public.content_shares;
create policy "content_shares_admin_write" on public.content_shares for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "content_views_select" on public.content_views;
create policy "content_views_select" on public.content_views for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
drop policy if exists "content_views_insert_own" on public.content_views;
create policy "content_views_insert_own" on public.content_views for insert to authenticated
  with check (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Storage: private 'cvs' bucket (members manage their own; admins read)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('cvs', 'cvs', false)
  on conflict (id) do nothing;

drop policy if exists "cvs_owner_insert" on storage.objects;
create policy "cvs_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "cvs_owner_select" on storage.objects;
create policy "cvs_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
drop policy if exists "cvs_owner_delete" on storage.objects;
create policy "cvs_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- 6. Clear demo course/session content — ONLY on first run (no real content
--    links yet). Once you add real content via Admin → ניהול תכנים this never
--    fires again, so re-running this bundle is safe.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.content_links) then
    delete from public.enrollments;
    delete from public.recordings;
    delete from public.sessions;
    delete from public.courses;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Full member intake profile questions (idempotent on key)
-- ---------------------------------------------------------------------------
insert into public.config_questions (key, label_he, field_type, required, sort_order, scope, options) values
  ('id_number',       'תעודת זהות', 'text', false, 11, 'all', '[]'::jsonb),
  ('phone',           'טלפון נייד', 'text', false, 12, 'all', '[]'::jsonb),
  ('city',            'עיר מגורים', 'text', false, 13, 'all', '[]'::jsonb),
  ('marital_status',  'מצב משפחתי', 'select', false, 14, 'all',
    '[{"value":"single","label":"רווקה"},{"value":"married","label":"נשואה"},{"value":"divorced","label":"גרושה"},{"value":"widowed","label":"אלמנה"},{"value":"other","label":"אחר"}]'::jsonb),
  ('prev_surname',    'שם משפחה קודם (אם רלוונטי)', 'text', false, 15, 'all', '[]'::jsonb),
  ('study_place',     'מקום לימודים', 'text', false, 20, 'junior', '[]'::jsonb),
  ('track',           'מגמה', 'select', false, 21, 'junior',
    '[{"value":"software","label":"הנדסת תוכנה"},{"value":"cs","label":"מדעי המחשב"},{"value":"practical_se","label":"הנדסאית תוכנה"},{"value":"electronics","label":"חשמל ואלקטרוניקה"},{"value":"qa","label":"בדיקות תוכנה / QA"},{"value":"cyber","label":"סייבר"},{"value":"other","label":"אחר"}]'::jsonb),
  ('track_specialization', 'התמחות ספציפית למגמה (אם היתה התמחות מלאה)', 'text', false, 22, 'junior', '[]'::jsonb),
  ('coordinator_name','שם רכזת המגמה', 'text', false, 23, 'junior', '[]'::jsonb),
  ('coordinator_phone','טלפון רכזת המגמה', 'text', false, 24, 'junior', '[]'::jsonb),
  ('coordinator_email','מייל רכזת המגמה', 'text', false, 25, 'junior', '[]'::jsonb),
  ('certificate',     'תעודה', 'select', false, 26, 'junior',
    '[{"value":"practical_eng","label":"הנדסאית"},{"value":"vocational","label":"תעודת מקצוע"},{"value":"degree","label":"תואר"},{"value":"other","label":"אחר"}]'::jsonb),
  ('graduation_year', 'שנת סיום לימודים (בהנדסאית — סיום שנה ב'')', 'number', false, 27, 'junior', '[]'::jsonb),
  ('dev_tech',        'אילו טכנולוגיות פיתוח למדת/התנסית בפועל? (רק כאלה שבאמת התנסית בהן)', 'multiselect', false, 30, 'junior',
    '[{"value":"react","label":"React"},{"value":"nodejs","label":"Node.js"},{"value":"typescript","label":"TypeScript"},{"value":"javascript","label":"JavaScript"},{"value":"python","label":"Python"},{"value":"sql","label":"SQL"},{"value":"css","label":"CSS"},{"value":"java","label":"Java"},{"value":"csharp","label":"C#"},{"value":"go","label":"Go"}]'::jsonb),
  ('genai_known',     'טכנולוגיות GenAI שיש לך בהן ידע אמיתי', 'text', false, 31, 'junior', '[]'::jsonb),
  ('genai_practiced', 'טכנולוגיות GenAI שהתנסית בהן בפועל (יצרת פרויקט)', 'text', false, 32, 'junior', '[]'::jsonb),
  ('ai_project_links','קישורים לפרויקטי AI שעשית', 'text', false, 33, 'junior', '[]'::jsonb),
  ('ai_tools_used',   'באיזה כלי AI יצא לך להשתמש בפועל?', 'text', false, 34, 'junior', '[]'::jsonb),
  ('ai_gaps',         'איזה חומר ב-AI את מרגישה שחסר לך?', 'text', false, 35, 'junior', '[]'::jsonb),
  ('practicum_done',  'עשית פרקטיקום / פרויקט עם לקוח אמיתי?', 'bool', false, 40, 'junior', '[]'::jsonb),
  ('practicum_employer','אם כן — מי היה המעסיק?', 'text', false, 41, 'junior', '[]'::jsonb),
  ('practicum_tech',  'אם כן — באילו טכנולוגיות?', 'text', false, 42, 'junior', '[]'::jsonb),
  ('remote_commute',  'משרה היברידית רחוקה ממגוריי — מתאים לי להתאמץ להגיע?', 'bool', false, 50, 'junior', '[]'::jsonb),
  ('practicum_placement', 'השמה דרך פרקטיקום (3 חודשים ללא שכר ואז קליטה) — להציע לי?', 'bool', false, 51, 'junior', '[]'::jsonb),
  ('paid_placement',  'השמה בתשלום (עלות כ-2500₪ אם אתקבל) — להציע לי?', 'bool', false, 52, 'junior', '[]'::jsonb),
  ('notes_for_us',    'יש לך משהו לומר לנו?', 'text', false, 60, 'all', '[]'::jsonb)
on conflict (key) do nothing;
