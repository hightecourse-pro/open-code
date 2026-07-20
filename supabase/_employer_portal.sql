-- ============================================================================
-- Open Code — employer portal. Run in the SQL Editor. Safe to re-run.
--
-- A separate, credentialed area where a hiring company browses candidate
-- profiles instead of receiving CVs by email. Clients are NOT community
-- members: they get a username (the company name) and a short password we
-- generate, and they never touch the members' app.
--
-- Privacy is the spine of this feature:
--   * config_questions.employer_visible decides, per question, what a client
--     may see. Default is FALSE — a new question is private until an admin
--     opts it in. ID numbers, phones and addresses stay off by default.
--   * profiles.portal_listed lets a member keep herself out of the portal.
--   * VIP flags and internal notes live in member_crm and are never read by
--     portal code at all.
-- ============================================================================

-- 1. Portal clients ----------------------------------------------------------
create table if not exists public.portal_clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  username text not null unique,
  password_hash text not null,          -- scrypt(password, salt)
  password_salt text not null,
  contact_name text,
  contact_email text,
  is_active boolean not null default true,
  notes text,                            -- internal, never shown to the client
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.portal_clients enable row level security;
-- Admins only. The portal itself authenticates with its own cookie and reads
-- through the service role, so no member-facing policy is needed.
drop policy if exists "portal_clients_admin" on public.portal_clients;
create policy "portal_clients_admin" on public.portal_clients
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 2. Jobs belong to a client, applications carry the CV that was sent --------
alter table public.jobs
  add column if not exists client_id uuid references public.portal_clients(id) on delete set null;

alter table public.applications
  add column if not exists cv_document_id uuid references public.cv_documents(id) on delete set null;

-- 3. What a client may see ---------------------------------------------------
alter table public.config_questions
  add column if not exists employer_visible boolean not null default false;

-- Sensible starting set: everything professional, nothing personal.
update public.config_questions set employer_visible = true
where key in (
  'specialization','region','dev_tech','tech_stack','language_skills','bio','github',
  'study_place','certificate','track_specialization','unique_courses','graduation_year',
  'genai_known','genai_practiced','ai_tools_used','ai_project_links','ai_gaps',
  'years_experience','exp_role','exp_tech','exp_languages','currently_working',
  'current_workplace','work_description','specific_job',
  'practicum_done','practicum_employer','practicum_tech','practicum_placement',
  'remote_commute','paid_placement'
);

-- Explicitly private, even if a future seed flips the default.
update public.config_questions set employer_visible = false
where key in (
  'id_number','phone','city','street','house_number','marital_status',
  'prev_surname','coordinator_name','notes_for_us','has_experience'
);

-- 4. A member can keep herself out of the portal -----------------------------
alter table public.profiles
  add column if not exists portal_listed boolean not null default true;

-- 5. Shared AI key pool (portal free-text search) ----------------------------
-- Community members bring their own key for their own tools; the portal's
-- smart search runs on this admin-managed pool instead.
create table if not exists public.system_ai_keys (
  id uuid primary key default gen_random_uuid(),
  label text,
  key_cipher text not null,
  key_last4 text,
  status text not null default 'active',   -- active | exhausted | invalid
  last_error text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.system_ai_keys enable row level security;
drop policy if exists "system_ai_keys_admin" on public.system_ai_keys;
create policy "system_ai_keys_admin" on public.system_ai_keys
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Daily counters, so the admin screen can show each key's usage per day.
create table if not exists public.system_ai_key_usage (
  key_id uuid not null references public.system_ai_keys(id) on delete cascade,
  day date not null default current_date,
  calls integer not null default 0,
  errors integer not null default 0,
  primary key (key_id, day)
);

alter table public.system_ai_key_usage enable row level security;
drop policy if exists "system_ai_key_usage_admin" on public.system_ai_key_usage;
create policy "system_ai_key_usage_admin" on public.system_ai_key_usage
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Atomic counter bump, called by the service role after each portal search.
create or replace function public.bump_ai_key_usage(p_key uuid, p_error boolean default false)
returns void language sql security definer set search_path = '' as $$
  insert into public.system_ai_key_usage (key_id, day, calls, errors)
  values (p_key, current_date, 1, case when p_error then 1 else 0 end)
  on conflict (key_id, day) do update
    set calls = public.system_ai_key_usage.calls + 1,
        errors = public.system_ai_key_usage.errors + (case when p_error then 1 else 0 end);
$$;

-- It's a SECURITY DEFINER writer — only the service role should call it, never
-- a logged-in member inflating the counters.
revoke all on function public.bump_ai_key_usage(uuid, boolean) from public, authenticated;
