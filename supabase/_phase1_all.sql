-- ╔══════════════════════════════════════════════════════════════╗
-- ║  Open Code — Phase 1 bundle (migrations + seed)               ║
-- ║  First-time setup: paste this whole file into Supabase →      ║
-- ║  SQL Editor → Run. Canonical source = migrations/*.sql        ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ============================================================================
-- Open Code — Phase 1 foundations
-- Profiles & roles, subscriptions/payments, RLS helpers, auth trigger.
-- Apply via Supabase Dashboard → SQL Editor (or `supabase db push`).
-- ============================================================================

-- ---------- shared: updated_at touch ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- enums ----------
create type public.user_role as enum ('junior', 'mentor', 'admin');
create type public.member_tier as enum ('paid', 'free');
create type public.profile_status as enum ('pending', 'active', 'paused', 'rejected');
create type public.subscription_plan as enum ('monthly', 'annual');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
create type public.payment_status as enum ('succeeded', 'failed', 'refunded');
create type public.mentor_availability as enum ('available', 'busy', 'away');

-- ============================================================================
-- profiles — one row per auth user
-- ============================================================================
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  avatar_initials text,
  region        text,
  specialization text,
  bio           text,
  links         jsonb not null default '{}'::jsonb,
  role          public.user_role not null default 'junior',
  member_tier   public.member_tier not null default 'paid',
  status        public.profile_status not null default 'pending',
  is_experienced boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- mentor extension ----------
create table public.mentor_profiles (
  profile_id        uuid primary key references public.profiles (id) on delete cascade,
  years_experience  int,
  domains           text[] not null default '{}',
  reviews_cv        boolean not null default false,
  reviews_interviews boolean not null default false,
  leads_sessions    boolean not null default false,
  availability      public.mentor_availability not null default 'available',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger mentor_profiles_set_updated_at
  before update on public.mentor_profiles
  for each row execute function public.set_updated_at();

-- ---------- mentorships (mentor ↔ mentee) ----------
create table public.mentorships (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.profiles (id) on delete cascade,
  mentee_id  uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'active',
  started_at timestamptz not null default now(),
  unique (mentor_id, mentee_id)
);

-- ============================================================================
-- subscriptions & payments — written ONLY by the service role (webhooks)
-- ============================================================================
create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  provider        text not null default 'nedarim',
  provider_sub_id text,
  plan            public.subscription_plan not null default 'monthly',
  status          public.subscription_status not null default 'trialing',
  min_term_months int not null default 3,
  current_period_end timestamptz,
  started_at      timestamptz not null default now(),
  canceled_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index subscriptions_profile_id_idx on public.subscriptions (profile_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  profile_id          uuid not null references public.profiles (id) on delete cascade,
  provider_payment_id text,
  amount_agorot       int not null,
  currency            text not null default 'ILS',
  status              public.payment_status not null default 'succeeded',
  paid_at             timestamptz,
  raw                 jsonb,
  created_at          timestamptz not null default now()
);

create index payments_profile_id_idx on public.payments (profile_id);

-- ============================================================================
-- RLS helper functions (SECURITY DEFINER → bypass RLS, avoid recursion)
-- ============================================================================
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.is_mentor()
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'mentor'
  );
$$;

create or replace function public.has_active_sub()
returns boolean language sql security definer stable set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.subscriptions s
    where s.profile_id = (select auth.uid())
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- ============================================================================
-- auth trigger — create a pending profile when a user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', 'מ'), 1)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- guard: members may edit their own profile but NOT escalate role/status/tier
-- ============================================================================
create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.member_tier := old.member_tier;
  end if;
  return new;
end;
$$;

create trigger guard_profile_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.mentor_profiles enable row level security;
alter table public.mentorships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- profiles: see self always; see others only with an active sub (or admin)
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.has_active_sub());

-- members update their own row (privileged columns are reset by the guard trigger)
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- admins can do anything
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- mentor_profiles: readable by any active member; writable by the mentor or admin
create policy "mentor_profiles_select" on public.mentor_profiles
  for select to authenticated
  using (public.has_active_sub());
create policy "mentor_profiles_write_own" on public.mentor_profiles
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

-- mentorships: visible to the two participants or admin
create policy "mentorships_select" on public.mentorships
  for select to authenticated
  using (mentor_id = (select auth.uid()) or mentee_id = (select auth.uid()) or public.is_admin());
create policy "mentorships_admin_write" on public.mentorships
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- subscriptions/payments: owner may read, admin may read; writes only via service role
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy "payments_select_own" on public.payments
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());

-- ============================================================================
-- Open Code — Phase 1 dynamic configuration
-- Admin-editable profile questions, taxonomies (tech/categories/regions), and
-- each member's answers. This is what lets admins change the member profile
-- form without code changes (the Admin → Configuration screen).
-- ============================================================================

create type public.field_type as enum ('text', 'select', 'multiselect', 'number', 'bool', 'tags');
create type public.question_scope as enum ('junior', 'mentor', 'all');
create type public.taxonomy_kind as enum ('tech', 'project_category', 'region', 'specialization', 'list');

-- ---------- config_questions ----------
create table public.config_questions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  label_he    text not null,
  field_type  public.field_type not null default 'text',
  required    boolean not null default false,
  sort_order  int not null default 0,
  active      boolean not null default true,
  scope       public.question_scope not null default 'all',
  options     jsonb not null default '[]'::jsonb,  -- for select/multiselect
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger config_questions_set_updated_at
  before update on public.config_questions
  for each row execute function public.set_updated_at();

-- ---------- config_taxonomies ----------
create table public.config_taxonomies (
  id          uuid primary key default gen_random_uuid(),
  kind        public.taxonomy_kind not null,
  value       text not null,
  label_he    text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (kind, value)
);

create index config_taxonomies_kind_idx on public.config_taxonomies (kind) where active;

-- ---------- profile_answers ----------
create table public.profile_answers (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.config_questions (id) on delete cascade,
  value       jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, question_id)
);

create trigger profile_answers_set_updated_at
  before update on public.profile_answers
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.config_questions enable row level security;
alter table public.config_taxonomies enable row level security;
alter table public.profile_answers enable row level security;

-- config is readable by any authenticated user; writable by admins only
create policy "config_questions_select" on public.config_questions
  for select to authenticated using (true);
create policy "config_questions_admin_write" on public.config_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "config_taxonomies_select" on public.config_taxonomies
  for select to authenticated using (true);
create policy "config_taxonomies_admin_write" on public.config_taxonomies
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- answers: your own always; others' only with an active sub (profile viewing)
create policy "profile_answers_select" on public.profile_answers
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.has_active_sub());
-- but you may only write your own answers
create policy "profile_answers_write_own" on public.profile_answers
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ============================================================================
-- Open Code — Phase 1 community (feed / forum)
-- Posts, comments, reactions, and a moderation report queue.
-- ============================================================================

create type public.post_kind as enum ('feed', 'forum');
create type public.post_intent as enum ('consult', 'knowledge', 'success');
create type public.post_status as enum ('visible', 'removed');
create type public.reaction_kind as enum ('like', 'save');
create type public.report_target as enum ('post', 'comment');
create type public.report_status as enum ('open', 'reviewed', 'dismissed');

-- ---------- posts ----------
create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  kind        public.post_kind not null default 'feed',
  intent      public.post_intent not null default 'knowledge',
  body        text not null,
  tech_tags   text[] not null default '{}',
  is_official boolean not null default false,
  is_pinned   boolean not null default false,
  status      public.post_status not null default 'visible',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index posts_kind_created_idx on public.posts (kind, created_at desc);
create index posts_author_idx on public.posts (author_id);

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- ---------- comments ----------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- ---------- reactions (likes / saves on posts) ----------
create table public.reactions (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind       public.reaction_kind not null default 'like',
  created_at timestamptz not null default now(),
  unique (post_id, profile_id, kind)
);

create index reactions_post_idx on public.reactions (post_id);

-- ---------- reports (moderation queue) ----------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  target_type public.report_target not null,
  target_id   uuid not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text,
  status      public.report_status not null default 'open',
  created_at  timestamptz not null default now()
);

-- guard: only admins may set is_official / is_pinned
create or replace function public.guard_post_flags()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if tg_op = 'INSERT' then
      new.is_official := false;
      new.is_pinned := false;
    else
      new.is_official := old.is_official;
      new.is_pinned := old.is_pinned;
      new.status := old.status;  -- members can't un/remove posts via status
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_post_flags_ins
  before insert on public.posts
  for each row execute function public.guard_post_flags();
create trigger guard_post_flags_upd
  before update on public.posts
  for each row execute function public.guard_post_flags();

-- ============================================================================
-- RLS — everything here requires an active subscription to read
-- ============================================================================
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;

-- posts: active members see visible posts (+ your own, + admin sees all)
create policy "posts_select" on public.posts
  for select to authenticated
  using (
    public.has_active_sub()
    and (status = 'visible' or author_id = (select auth.uid()) or public.is_admin())
  );
create policy "posts_insert_own" on public.posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.has_active_sub());
create policy "posts_update_own" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) or public.is_admin())
  with check (author_id = (select auth.uid()) or public.is_admin());
create policy "posts_delete_own" on public.posts
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- comments
create policy "comments_select" on public.comments
  for select to authenticated using (public.has_active_sub());
create policy "comments_insert_own" on public.comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.has_active_sub());
create policy "comments_modify_own" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) or public.is_admin())
  with check (author_id = (select auth.uid()) or public.is_admin());
create policy "comments_delete_own" on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- reactions: read with active sub; write only your own
create policy "reactions_select" on public.reactions
  for select to authenticated using (public.has_active_sub());
create policy "reactions_write_own" on public.reactions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()) and public.has_active_sub());

-- reports: members file their own; only admins read/triage
create policy "reports_insert_own" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and public.has_active_sub());
create policy "reports_admin_read" on public.reports
  for select to authenticated using (public.is_admin());
create policy "reports_admin_update" on public.reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Open Code — seed data (taxonomies + starter profile questions)
-- Safe to re-run: uses ON CONFLICT DO NOTHING.
-- ============================================================================

-- ---------- regions ----------
insert into public.config_taxonomies (kind, value, label_he, sort_order) values
  ('region', 'center',     'מרכז', 1),
  ('region', 'north',      'צפון', 2),
  ('region', 'south',      'דרום', 3),
  ('region', 'jerusalem',  'ירושלים והסביבה', 4),
  ('region', 'sharon',     'השרון', 5),
  ('region', 'shfela',     'השפלה', 6),
  ('region', 'remote',     'עבודה מרחוק', 7)
on conflict (kind, value) do nothing;

-- ---------- specializations ----------
insert into public.config_taxonomies (kind, value, label_he, sort_order) values
  ('specialization', 'frontend',  'פרונטאנד', 1),
  ('specialization', 'backend',   'באקאנד', 2),
  ('specialization', 'fullstack', 'פולסטאק', 3),
  ('specialization', 'qa',        'QA / בדיקות', 4),
  ('specialization', 'devops',    'DevOps', 5),
  ('specialization', 'data',      'דאטה / AI', 6),
  ('specialization', 'mobile',    'מובייל', 7)
on conflict (kind, value) do nothing;

-- ---------- technologies ----------
insert into public.config_taxonomies (kind, value, label_he, sort_order) values
  ('tech', 'react',      'React', 1),
  ('tech', 'nodejs',     'Node.js', 2),
  ('tech', 'typescript', 'TypeScript', 3),
  ('tech', 'javascript', 'JavaScript', 4),
  ('tech', 'python',     'Python', 5),
  ('tech', 'sql',        'SQL', 6),
  ('tech', 'css',        'CSS', 7),
  ('tech', 'java',       'Java', 8),
  ('tech', 'csharp',     'C#', 9),
  ('tech', 'go',         'Go', 10)
on conflict (kind, value) do nothing;

-- ---------- project categories (for forum / jobs tagging) ----------
insert into public.config_taxonomies (kind, value, label_he, sort_order) values
  ('project_category', 'web',     'אתרים ואפליקציות web', 1),
  ('project_category', 'mobile',  'אפליקציות מובייל', 2),
  ('project_category', 'data',    'דאטה ובינה מלאכותית', 3),
  ('project_category', 'infra',   'תשתיות ו-DevOps', 4)
on conflict (kind, value) do nothing;

-- ---------- starter profile questions ----------
insert into public.config_questions (key, label_he, field_type, required, sort_order, scope, options) values
  ('specialization', 'מה התחום שלך?', 'select', true, 1, 'all',
   '[{"value":"frontend","label":"פרונטאנד"},{"value":"backend","label":"באקאנד"},{"value":"fullstack","label":"פולסטאק"},{"value":"qa","label":"QA / בדיקות"},{"value":"devops","label":"DevOps"},{"value":"data","label":"דאטה / AI"},{"value":"mobile","label":"מובייל"}]'::jsonb),
  ('region', 'אזור מגורים', 'select', true, 2, 'all',
   '[{"value":"center","label":"מרכז"},{"value":"north","label":"צפון"},{"value":"south","label":"דרום"},{"value":"jerusalem","label":"ירושלים והסביבה"},{"value":"sharon","label":"השרון"},{"value":"shfela","label":"השפלה"},{"value":"remote","label":"עבודה מרחוק"}]'::jsonb),
  ('tech_stack', 'הטכנולוגיות שלך', 'multiselect', false, 3, 'all',
   '[{"value":"react","label":"React"},{"value":"nodejs","label":"Node.js"},{"value":"typescript","label":"TypeScript"},{"value":"python","label":"Python"},{"value":"sql","label":"SQL"},{"value":"css","label":"CSS"},{"value":"java","label":"Java"}]'::jsonb),
  ('bio', 'קצת עליך', 'text', false, 4, 'all', '[]'::jsonb),
  ('github', 'קישור ל-GitHub', 'text', false, 5, 'all', '[]'::jsonb),
  ('years_experience', 'שנות ניסיון', 'number', false, 6, 'mentor', '[]'::jsonb)
on conflict (key) do nothing;
