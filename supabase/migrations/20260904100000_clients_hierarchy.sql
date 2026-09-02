-- Clients hierarchy (the owner, 3/9): the CRM becomes the client registry —
-- every client carries her contacts, under each client her jobs, and under
-- each job the women recruited for it. hires and jobs link to the client
-- record instead of a free-text company name.

alter table public.portal_clients add column if not exists company_number text;
alter table public.portal_clients add column if not exists address text;

-- Up to four contacts arrived in the owner's sheet; a client keeps any number.
create table if not exists public.client_contacts (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.portal_clients (id) on delete cascade,
  name         text not null,      -- איש קשר (short name)
  display_name text,               -- שם תצוגה במייל
  email        text,
  phone        text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists client_contacts_client_idx on public.client_contacts (client_id, sort_order);

alter table public.client_contacts enable row level security;
drop policy if exists client_contacts_admin on public.client_contacts;
create policy client_contacts_admin on public.client_contacts
  for all using (public.is_admin()) with check (public.is_admin());

-- The hierarchy links. Company stays as display text; the id is the truth.
alter table public.jobs add column if not exists client_id uuid references public.portal_clients (id) on delete set null;
alter table public.hires add column if not exists client_id uuid references public.portal_clients (id) on delete set null;
alter table public.hires add column if not exists job_id uuid references public.jobs (id) on delete set null;

create index if not exists jobs_client_idx on public.jobs (client_id);
create index if not exists hires_client_idx on public.hires (client_id);
create index if not exists hires_job_idx on public.hires (job_id);
