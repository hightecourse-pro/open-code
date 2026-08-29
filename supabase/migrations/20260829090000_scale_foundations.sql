-- Scale foundations (2026-08-29): everything the thousands-of-members plan
-- hangs on — set-based email resolution instead of per-member auth API calls,
-- queue tables for the mail fan-outs, denormalized forum counters, the
-- missing hot-path indexes, and SQL aggregates for screens that used to load
-- whole tables.

-- ── 1. Email resolution, set-based ------------------------------------------
-- Replaces every auth.admin.getUserById() loop. SECURITY DEFINER because
-- auth.users is not otherwise readable; locked to service_role only.
create or replace function public.member_emails(p_ids uuid[])
returns table (id uuid, email text)
language sql
security definer
set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users u
  where u.id = any (p_ids);
$$;
revoke all on function public.member_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.member_emails(uuid[]) to service_role;

-- The webhook's email→member lookup (used to page listUsers 1000 at a time).
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select u.id from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;
revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- ── 2. Session-reminder queue (per-recipient, drained in bounded batches) ---
-- The old model claimed (session, stage) and then mailed the WHOLE pool in one
-- serverless invocation — 3,000 members would blow the 60s limit mid-loop with
-- the stage already claimed, silently skipping most of them. Now the claim
-- enqueues rows; every 10-minute tick drains a bounded batch.
create table if not exists public.session_reminder_queue (
  session_id uuid not null references public.sessions(id) on delete cascade,
  stage text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (session_id, stage, profile_id)
);
alter table public.session_reminder_queue enable row level security;
-- service-role only — no policies on purpose.
create index if not exists session_reminder_queue_unsent_idx
  on public.session_reminder_queue (created_at)
  where sent_at is null;

-- ── 3. Digest fairness -------------------------------------------------------
-- The daily digest now runs in a morning window of bounded batches; this stamp
-- is both the fairness ordering and the once-a-day guard.
alter table public.profiles add column if not exists digest_last_sent_at timestamptz;
create index if not exists profiles_digest_order_idx
  on public.profiles (digest_last_sent_at asc nulls first)
  where status = 'active';

-- Unread-per-recipient in one aggregate (the digest used to fetch every
-- conversation row and every unread message row into JS).
create or replace function public.digest_unread_counts()
returns table (recipient uuid, unread bigint, senders uuid[])
language sql
security definer
set search_path = ''
as $$
  select case when c.a_id = m.sender_id then c.b_id else c.a_id end as recipient,
         count(*) as unread,
         (array_agg(distinct m.sender_id))[1:5] as senders
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.read_at is null
  group by 1;
$$;
revoke all on function public.digest_unread_counts() from public, anon, authenticated;
grant execute on function public.digest_unread_counts() to service_role;

-- ── 4. Forum counters, maintained by triggers --------------------------------
-- The forum list used to fetch every comment and reaction row of the listed
-- topics to count them in JS (silently capped at 1000 rows).
alter table public.posts add column if not exists reply_count integer not null default 0;
alter table public.posts add column if not exists like_count integer not null default 0;
alter table public.posts add column if not exists last_reply_at timestamptz;

create or replace function public.bump_post_reply_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
       set reply_count = reply_count + 1, last_reply_at = new.created_at
     where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
       set reply_count = greatest(reply_count - 1, 0)
     where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;
drop trigger if exists posts_reply_count_trg on public.comments;
create trigger posts_reply_count_trg
  after insert or delete on public.comments
  for each row execute function public.bump_post_reply_count();

create or replace function public.bump_post_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.kind = 'like' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' and old.kind = 'like' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists posts_like_count_trg on public.reactions;
create trigger posts_like_count_trg
  after insert or delete on public.reactions
  for each row execute function public.bump_post_like_count();

-- Backfill from today's truth.
update public.posts p
   set reply_count = coalesce(c.n, 0),
       last_reply_at = c.last_at
  from (select post_id, count(*) n, max(created_at) last_at
          from public.comments group by post_id) c
 where c.post_id = p.id;
update public.posts p
   set like_count = coalesce(r.n, 0)
  from (select post_id, count(*) n
          from public.reactions where kind = 'like' group by post_id) r
 where r.post_id = p.id;

-- ── 5. Hot-path indexes + cleanups ------------------------------------------
-- Webhook idempotency probe (bursts on Nedarim charge days) — seq-scanned.
create unique index if not exists payments_provider_payment_idx
  on public.payments (provider_payment_id)
  where provider_payment_id is not null;
-- Queried in the APP LAYOUT for signed-in members (feedback banner).
create index if not exists session_feedback_profile_idx
  on public.session_feedback (profile_id);
-- Exact duplicates of composite indexes on the two fastest-growing tables.
drop index if exists public.comments_post_idx;
drop index if exists public.content_views_member_idx;

-- initplan + role hygiene on the newest policy (the 20260819 sweep predates it).
drop policy if exists mentor_admin_log_admin on public.mentor_admin_log;
create policy mentor_admin_log_admin on public.mentor_admin_log
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ── 6. SQL aggregates for screens that loaded whole tables -------------------
-- Per-job application counters (admin jobs list badges).
create or replace function public.job_app_counts()
returns table (job_id uuid, total bigint, new_count bigint)
language sql
security definer
set search_path = ''
as $$
  select a.job_id, count(*) as total,
         count(*) filter (where a.status = 'submitted') as new_count
  from public.applications a
  where a.status <> 'draft'
  group by a.job_id;
$$;
revoke all on function public.job_app_counts() from public, anon, authenticated;
grant execute on function public.job_app_counts() to service_role;

-- Forum answers per mentor (the public mentor score) — was a full row fetch.
create or replace function public.mentor_answer_counts(p_ids uuid[])
returns table (author_id uuid, answers bigint)
language sql
security definer
set search_path = ''
as $$
  select c.author_id, count(*) as answers
  from public.comments c
  join public.posts p on p.id = c.post_id
  where c.author_id = any (p_ids)
    and p.author_id <> c.author_id
  group by c.author_id;
$$;
revoke all on function public.mentor_answer_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.mentor_answer_counts(uuid[]) to service_role;

-- Learning analytics, aggregated in the database instead of shipping the
-- whole content_views/enrollments tables to the page.
create or replace function public.analytics_owner_totals()
returns table (owner_type text, owner_id uuid, opens bigint, uniques bigint, last_open timestamptz)
language sql
security definer
set search_path = ''
as $$
  select v.owner_type::text, v.owner_id, count(*) as opens,
         count(distinct v.profile_id) as uniques, max(v.created_at) as last_open
  from public.content_views v
  where v.owner_type is not null and v.owner_id is not null
  group by v.owner_type, v.owner_id;
$$;
revoke all on function public.analytics_owner_totals() from public, anon, authenticated;
grant execute on function public.analytics_owner_totals() to service_role;

create or replace function public.analytics_summary()
returns table (active_learners bigint, total_opens bigint)
language sql
security definer
set search_path = ''
as $$
  select count(distinct profile_id) as active_learners, count(*) as total_opens
  from public.content_views;
$$;
revoke all on function public.analytics_summary() from public, anon, authenticated;
grant execute on function public.analytics_summary() to service_role;

-- The proactive junior search (mentor matching) — pushed into SQL with a hard
-- limit instead of loading every junior and every answer.
create or replace function public.search_juniors(p_q text, p_tech text, p_min_years int, p_limit int default 30)
returns table (id uuid, full_name text, avatar_initials text, specialization text, years numeric, tech text[])
language sql
security definer
set search_path = ''
as $$
  with juniors as (
    select p.id, p.full_name, p.avatar_initials, p.specialization
    from public.profiles p
    where p.role = 'junior' and p.status = 'active' and p.profile_completed
      and (coalesce(trim(p_q), '') = ''
           or p.full_name ilike '%' || trim(p_q) || '%'
           or coalesce(p.specialization, '') ilike '%' || trim(p_q) || '%')
  ),
  years as (
    select a.profile_id, (a.value #>> '{}')::numeric as years
    from public.profile_answers a
    join public.config_questions q on q.id = a.question_id
    where q.key = 'years_experience'
      and jsonb_typeof(a.value) = 'number'
  ),
  techs as (
    select a.profile_id, array_agg(distinct t.v) as tech
    from public.profile_answers a
    join public.config_questions q on q.id = a.question_id
    cross join lateral jsonb_array_elements_text(a.value) as t(v)
    where q.key in ('dev_tech', 'exp_tech', 'tech_stack', 'genai_practiced')
      and jsonb_typeof(a.value) = 'array'
    group by a.profile_id
  )
  select j.id, j.full_name, j.avatar_initials, j.specialization,
         y.years, coalesce(t.tech, '{}') as tech
  from juniors j
  left join years y on y.profile_id = j.id
  left join techs t on t.profile_id = j.id
  where (coalesce(trim(p_tech), '') = '' or t.tech @> array[trim(p_tech)])
    and (coalesce(p_min_years, 0) <= 0 or coalesce(y.years, 0) >= p_min_years)
  order by j.full_name
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;
revoke all on function public.search_juniors(text, text, int, int) from public, anon, authenticated;
grant execute on function public.search_juniors(text, text, int, int) to service_role;
