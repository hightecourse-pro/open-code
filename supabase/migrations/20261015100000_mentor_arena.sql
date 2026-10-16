-- זירת המנטוריות (the owner, 15/10): every hackathon registrant may ask, every
-- mentor sees every question and answers; a first answer per question earns
-- arena points (counted live by mentor_arena_counts, like forum answers).

create table public.arena_questions (
  id               uuid primary key default gen_random_uuid(),
  author_id        uuid not null references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 3 and 160),
  body             text not null check (char_length(body) between 3 and 4000),
  -- The mentor the asker picked (or the random pick); null = "whoever answers first".
  target_mentor_id uuid references public.profiles (id) on delete set null,
  -- She asked for a mentor who knows AI.
  ai_only          boolean not null default false,
  status           text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  answered_at      timestamptz
);
create index arena_questions_status_idx on public.arena_questions (status, created_at desc);
create index arena_questions_author_idx on public.arena_questions (author_id);
create index arena_questions_target_idx on public.arena_questions (target_mentor_id) where target_mentor_id is not null;
create trigger arena_questions_set_updated_at
  before update on public.arena_questions
  for each row execute function public.set_updated_at();

create table public.arena_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.arena_questions (id) on delete cascade,
  mentor_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 6000),
  created_at  timestamptz not null default now()
);
create index arena_answers_question_idx on public.arena_answers (question_id, created_at);
create index arena_answers_mentor_idx on public.arena_answers (mentor_id);

alter table public.arena_questions enable row level security;
alter table public.arena_answers enable row level security;

-- Members read; the page decides who may ENTER (registrants, mentors, team).
-- Writes go through server actions with the service role.
create policy "arena_questions_select" on public.arena_questions
  for select to authenticated using (public.is_member());
create policy "arena_answers_select" on public.arena_answers
  for select to authenticated using (public.is_member());
create policy "arena_questions_admin" on public.arena_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "arena_answers_admin" on public.arena_answers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Points: one counted answer per mentor per question - no farming a thread.
create or replace function public.mentor_arena_counts(p_ids uuid[])
returns table (mentor_id uuid, answers bigint)
language sql
security definer
set search_path = ''
as $$
  select a.mentor_id, count(distinct a.question_id)
  from public.arena_answers a
  where a.mentor_id = any (p_ids)
  group by a.mentor_id;
$$;
revoke all on function public.mentor_arena_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.mentor_arena_counts(uuid[]) to service_role;
