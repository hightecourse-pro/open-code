-- בקשות השלמה מצוותי ההאקתון (the owner, 24/10): when the automated review
-- could not run a project (login needed, product down, video unreachable,
-- repo private), the team gets a personal mail saying what is missing and a
-- place on her submission page to answer by the deadline. The admin sees what
-- was sent, the mail itself, and whether she answered. One row per team.
create table public.hackathon_review_requests (
  id              uuid primary key default gen_random_uuid(),
  team_key        text not null unique,
  -- [{kind: login|product|video|repo, detail}] - what is missing, in words the team reads
  items           jsonb not null default '[]'::jsonb,
  due_at          timestamptz not null,
  email_subject   text,
  email_html      text,
  sent_at         timestamptz,
  sent_to         text[],
  send_error      text,
  responded_at    timestamptz,
  responded_by    uuid references public.profiles (id) on delete set null,
  -- {login, product_url, video_url, repo_url, note}
  response        jsonb,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger hackathon_review_requests_set_updated_at
  before update on public.hackathon_review_requests
  for each row execute function public.set_updated_at();

alter table public.hackathon_review_requests enable row level security;
-- Members reach their own team's row through server actions (service role); the team sees everything.
create policy "hackathon_review_requests_admin" on public.hackathon_review_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
