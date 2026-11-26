-- ״תני לנו את הטאצ' שלך״ (Hightecourse 2026, Thursday 26.11): the anonymous touch-screen questionnaire of the
-- conference - ten questions, four answers each - and the wide LED screen that shows the answers as live charts.
-- One row per answer: session_id is a random id the kiosk makes for every ״מתחילים?״ press (no person behind it),
-- q = the question (1-10), a = the chosen answer (1-4). Going back and choosing again replaces the row.
-- Service-role only (no policies): /api/hc-touch is the door.
create table public.hc_touch_answers (
  session_id uuid not null,
  q smallint not null check (q between 1 and 10),
  a smallint not null check (a between 1 and 4),
  created_at timestamptz not null default now(),
  primary key (session_id, q)
);
comment on table public.hc_touch_answers is 'Anonymous answers of the conference touch-screen questionnaire (/touch); the LED screen (/touch/screen) reads the counts.';
alter table public.hc_touch_answers enable row level security;

-- The whole picture in forty rows at most, whatever the number of answers (PostgREST cuts plain selects at 1000 rows).
create function public.hc_touch_counts()
returns table (q smallint, a smallint, n bigint)
language sql stable
set search_path = public
as $$
  select t.q, t.a, count(*) from public.hc_touch_answers t group by t.q, t.a
$$;
revoke execute on function public.hc_touch_counts() from public, anon, authenticated;
grant execute on function public.hc_touch_counts() to service_role;
