-- זירת המנטוריות, round two (the owner, 16/10: "תשפר הכל"): private
-- questions, topics, pinned answers worth reading, follow-ups in the thread,
-- "עזר לי" on an answer (bonus points, auto-close), a nudge after 24h, and
-- "I am here now" presence for mentors.

alter table public.arena_questions
  add column if not exists is_private boolean not null default false,
  add column if not exists topic text,
  add column if not exists pinned_at timestamptz,
  add column if not exists nudged_at timestamptz,
  add column if not exists closed_at timestamptz;

alter table public.arena_answers
  add column if not exists author_role text not null default 'mentor' check (author_role in ('mentor', 'asker')),
  add column if not exists helpful_at timestamptz;
create index if not exists arena_answers_helpful_idx on public.arena_answers (mentor_id) where helpful_at is not null;

create table if not exists public.arena_presence (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  until      timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.arena_presence enable row level security;
create policy "arena_presence_admin" on public.arena_presence
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Points: a mentor's answers count once per question; "helped" answers add a bonus.
drop function if exists public.mentor_arena_counts(uuid[]);
create function public.mentor_arena_counts(p_ids uuid[])
returns table (mentor_id uuid, answers bigint, helpful bigint)
language sql
security definer
set search_path = ''
as $$
  select a.mentor_id,
         count(distinct a.question_id),
         count(distinct a.question_id) filter (where a.helpful_at is not null)
  from public.arena_answers a
  where a.mentor_id = any (p_ids) and a.author_role = 'mentor'
  group by a.mentor_id;
$$;
revoke all on function public.mentor_arena_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.mentor_arena_counts(uuid[]) to service_role;
