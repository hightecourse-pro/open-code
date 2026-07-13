-- ============================================================================
-- Open Code — professional articles (run once in the SQL Editor). Safe to re-run.
-- Admin-curated links/notes to professional content, visible to active members.
-- ============================================================================

create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  excerpt      text,
  url          text,
  category     text,
  author_name  text,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists articles_published_idx on public.articles (created_at desc) where is_published;

alter table public.articles enable row level security;

drop policy if exists "articles_select" on public.articles;
create policy "articles_select" on public.articles for select to authenticated
  using (public.has_active_sub() or public.is_admin());

drop policy if exists "articles_admin_write" on public.articles;
create policy "articles_admin_write" on public.articles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
