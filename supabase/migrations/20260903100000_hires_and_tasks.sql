-- גיוסים + משימות (the owner, 3/9).
--
-- hires: ONE central registry of every placement — community members marked
-- hired (auto-inserted the moment she's marked) and off-community placements
-- (added manually, "בשביל ההיסטוריה"). Carries the billing trail per hire:
-- status (started → invoice_sent → paid), amount, and who pays (the study
-- institution — resolved from her profile — or the member herself).
-- manual_hires stays in place as history; hires is the source of truth from
-- now on (existing rows are migrated below).
create table if not exists public.hires (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid references public.profiles (id) on delete set null,
  full_name         text not null,
  email             text,
  company           text,
  job_type          text,               -- practicum_placement / temp / immediate
  source            text not null default 'community' check (source in ('community', 'external')),
  status            text not null default 'started' check (status in ('started', 'invoice_sent', 'paid')),
  amount            numeric,
  payer             text check (payer in ('institution', 'member')),
  payer_institution text,               -- her study place, resolved from the profile
  hired_at          timestamptz not null default now(),
  notes             text,
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists hires_hired_at_idx on public.hires (hired_at desc);
create index if not exists hires_profile_idx on public.hires (profile_id);

alter table public.hires enable row level security;
drop policy if exists hires_admin on public.hires;
create policy hires_admin on public.hires
  for all using (public.is_admin()) with check (public.is_admin());
-- The celebration banner reads names via the service role — no member policy.

-- Existing off-community rows move over as-is.
insert into public.hires (profile_id, full_name, email, company, job_type, source, hired_at, created_by, created_at)
select profile_id, full_name, email, company, job_type, 'external', hired_at, created_by, created_at
from public.manual_hires
where not exists (
  select 1 from public.hires h
  where h.source = 'external' and h.full_name = manual_hires.full_name and h.hired_at = manual_hires.hired_at
);

-- Every member already marked as placed-by-us gets her community row.
insert into public.hires (profile_id, full_name, source, hired_at)
select p.id, p.full_name, 'community', coalesce(p.hired_at, now())
from public.profiles p
where p.hired_via_us = true
  and not exists (select 1 from public.hires h where h.profile_id = p.id);

-- ---------------------------------------------------------------------------
-- admin_tasks: the team's task list. Tasks arrive by hand or from system
-- triggers; each is routed to one team member.
create table if not exists public.admin_tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  details     text,
  link        text,                -- in-app path the task points at
  assignee_id uuid references public.profiles (id) on delete set null,
  status      text not null default 'open' check (status in ('open', 'done')),
  source      text not null default 'manual' check (source in ('manual', 'trigger')),
  trigger_key text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  done_at     timestamptz,
  done_by     uuid
);

create index if not exists admin_tasks_status_idx on public.admin_tasks (status, created_at desc);
create index if not exists admin_tasks_assignee_idx on public.admin_tasks (assignee_id);

alter table public.admin_tasks enable row level security;
drop policy if exists admin_tasks_admin on public.admin_tasks;
create policy admin_tasks_admin on public.admin_tasks
  for all using (public.is_admin()) with check (public.is_admin());

-- task_rules: which system events create a task, and who always receives it.
-- Seeded disabled — the owner decides per event when and to whom it routes.
create table if not exists public.task_rules (
  key         text primary key,
  label       text not null,
  assignee_id uuid references public.profiles (id) on delete set null,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.task_rules enable row level security;
drop policy if exists task_rules_admin on public.task_rules;
create policy task_rules_admin on public.task_rules
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.task_rules (key, label) values
  ('new_request',     'פניה חדשה לצוות'),
  ('new_application', 'הגשת מועמדות חדשה'),
  ('payment_failed',  'כשל חיוב / סירוב קבע'),
  ('member_hired',    'חברה סומנה כגויסה'),
  ('mentor_request',  'בקשה חדשה לליווי מנטורית'),
  ('new_member',      'חברה חדשה נרשמה')
on conflict (key) do nothing;
