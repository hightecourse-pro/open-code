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
  if (select auth.uid()) is not null and not public.is_admin() then
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
