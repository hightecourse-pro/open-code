-- Per-member read state for forum topics (Rachel Weinberger, 6/9: "כאשר יש
-- הודעה חדשה שלא קראתי זה לא מופיע לי בצורה שונה"). One row per topic a
-- member has opened; the list marks topics whose latest activity is newer
-- than her read stamp (or that gained activity after she joined and she
-- never opened).
create table public.post_reads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (profile_id, post_id)
);

alter table public.post_reads enable row level security;

create policy post_reads_own on public.post_reads
  for all
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
