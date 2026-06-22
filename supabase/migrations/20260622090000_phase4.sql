-- ============================================================================
-- Open Code — Phase 4
-- Admin CRM (VIP + notes + first-login gate), CV documents, course/session
-- content links (Drive), per-member shares, ratings/views/feedback, Storage.
-- ============================================================================

-- ---- profiles: CRM + onboarding gate ----
alter table public.profiles
  add column if not exists is_vip boolean not null default false,
  add column if not exists internal_notes text,
  add column if not exists profile_completed boolean not null default false;

-- ---- CV documents (Supabase Storage) ----
create type public.cv_language as enum ('he', 'en', 'job');

create table public.cv_documents (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  label       text not null,
  language    public.cv_language not null default 'he',
  file_path   text not null,             -- path in the 'cvs' storage bucket
  file_name   text,
  created_at  timestamptz not null default now()
);
create index cv_documents_owner_idx on public.cv_documents (profile_id, created_at desc);

-- ---- generic content links for courses & sessions ----
create type public.content_owner as enum ('course', 'session');
create type public.link_kind as enum ('video', 'materials');

create table public.content_links (
  id          uuid primary key default gen_random_uuid(),
  owner_type  public.content_owner not null,
  owner_id    uuid not null,
  kind        public.link_kind not null default 'video',
  title       text not null,
  url         text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index content_links_owner_idx on public.content_links (owner_type, owner_id, sort_order);

-- ---- per-member personal Drive shares (tracked; applied in Drive) ----
create type public.share_status as enum ('pending', 'shared', 'revoked');

create table public.content_shares (
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
create index content_shares_member_idx on public.content_shares (profile_id, status);
create index content_shares_pending_idx on public.content_shares (status) where status <> 'shared';

-- ---- enrollments: studied flag + rating + feedback ----
alter table public.enrollments
  add column if not exists studied boolean not null default false,
  add column if not exists rating int,
  add column if not exists feedback text;

-- ---- content views (per video, with who/when for admin detail) ----
create table public.content_views (
  id         uuid primary key default gen_random_uuid(),
  link_id    uuid not null references public.content_links (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index content_views_link_idx on public.content_views (link_id);
create index content_views_member_idx on public.content_views (profile_id);

-- ============================================================================
-- RLS
-- ============================================================================
alter table public.cv_documents enable row level security;
alter table public.content_links enable row level security;
alter table public.content_shares enable row level security;
alter table public.content_views enable row level security;

create policy "cv_documents_owner" on public.cv_documents for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()));

create policy "content_links_select" on public.content_links for select to authenticated
  using (public.has_active_sub());
create policy "content_links_admin_write" on public.content_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "content_shares_select" on public.content_shares for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy "content_shares_admin_write" on public.content_shares for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "content_views_select" on public.content_views for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy "content_views_insert_own" on public.content_views for insert to authenticated
  with check (profile_id = (select auth.uid()));

-- ============================================================================
-- Storage: private 'cvs' bucket (members manage their own; admins read)
-- ============================================================================
insert into storage.buckets (id, name, public) values ('cvs', 'cvs', false)
  on conflict (id) do nothing;

create policy "cvs_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cvs_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
create policy "cvs_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---- clear demo course/session content (keep the tables) ----
delete from public.enrollments;
delete from public.recordings;
delete from public.sessions;
delete from public.courses;
