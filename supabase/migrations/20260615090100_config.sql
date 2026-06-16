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
