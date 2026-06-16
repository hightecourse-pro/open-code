-- ============================================================================
-- Open Code — Phase 1 foundations
-- Profiles & roles, subscriptions/payments, RLS helpers, auth trigger.
-- Apply via Supabase Dashboard → SQL Editor (or `supabase db push`).
-- ============================================================================

-- ---------- shared: updated_at touch ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- enums ----------
create type public.user_role as enum ('junior', 'mentor', 'admin');
create type public.member_tier as enum ('paid', 'free');
create type public.profile_status as enum ('pending', 'active', 'paused', 'rejected');
create type public.subscription_plan as enum ('monthly', 'annual');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
create type public.payment_status as enum ('succeeded', 'failed', 'refunded');
create type public.mentor_availability as enum ('available', 'busy', 'away');

-- ============================================================================
-- profiles — one row per auth user
-- ============================================================================
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null default '',
  avatar_initials text,
  region        text,
  specialization text,
  bio           text,
  links         jsonb not null default '{}'::jsonb,
  role          public.user_role not null default 'junior',
  member_tier   public.member_tier not null default 'paid',
  status        public.profile_status not null default 'pending',
  is_experienced boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- mentor extension ----------
create table public.mentor_profiles (
  profile_id        uuid primary key references public.profiles (id) on delete cascade,
  years_experience  int,
  domains           text[] not null default '{}',
  reviews_cv        boolean not null default false,
  reviews_interviews boolean not null default false,
  leads_sessions    boolean not null default false,
  availability      public.mentor_availability not null default 'available',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger mentor_profiles_set_updated_at
  before update on public.mentor_profiles
  for each row execute function public.set_updated_at();

-- ---------- mentorships (mentor ↔ mentee) ----------
create table public.mentorships (
  id         uuid primary key default gen_random_uuid(),
  mentor_id  uuid not null references public.profiles (id) on delete cascade,
  mentee_id  uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'active',
  started_at timestamptz not null default now(),
  unique (mentor_id, mentee_id)
);

-- ============================================================================
-- subscriptions & payments — written ONLY by the service role (webhooks)
-- ============================================================================
create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  provider        text not null default 'nedarim',
  provider_sub_id text,
  plan            public.subscription_plan not null default 'monthly',
  status          public.subscription_status not null default 'trialing',
  min_term_months int not null default 3,
  current_period_end timestamptz,
  started_at      timestamptz not null default now(),
  canceled_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index subscriptions_profile_id_idx on public.subscriptions (profile_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  profile_id          uuid not null references public.profiles (id) on delete cascade,
  provider_payment_id text,
  amount_agorot       int not null,
  currency            text not null default 'ILS',
  status              public.payment_status not null default 'succeeded',
  paid_at             timestamptz,
  raw                 jsonb,
  created_at          timestamptz not null default now()
);

create index payments_profile_id_idx on public.payments (profile_id);

-- ============================================================================
-- RLS helper functions (SECURITY DEFINER → bypass RLS, avoid recursion)
-- ============================================================================
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.is_mentor()
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'mentor'
  );
$$;

create or replace function public.has_active_sub()
returns boolean language sql security definer stable set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.subscriptions s
    where s.profile_id = (select auth.uid())
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

-- ============================================================================
-- auth trigger — create a pending profile when a user signs up
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', 'מ'), 1)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- guard: members may edit their own profile but NOT escalate role/status/tier
-- ============================================================================
create or replace function public.guard_profile_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Restrict only a logged-in non-admin. Service role / SQL editor (auth.uid()
  -- is null) and admins may set privileged columns (bootstrap, webhooks).
  if (select auth.uid()) is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.member_tier := old.member_tier;
  end if;
  return new;
end;
$$;

create trigger guard_profile_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.mentor_profiles enable row level security;
alter table public.mentorships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- profiles: see self always; see others only with an active sub (or admin)
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.has_active_sub());

-- members update their own row (privileged columns are reset by the guard trigger)
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- admins can do anything
create policy "profiles_admin_all" on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- mentor_profiles: readable by any active member; writable by the mentor or admin
create policy "mentor_profiles_select" on public.mentor_profiles
  for select to authenticated
  using (public.has_active_sub());
create policy "mentor_profiles_write_own" on public.mentor_profiles
  for all to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin())
  with check (profile_id = (select auth.uid()) or public.is_admin());

-- mentorships: visible to the two participants or admin
create policy "mentorships_select" on public.mentorships
  for select to authenticated
  using (mentor_id = (select auth.uid()) or mentee_id = (select auth.uid()) or public.is_admin());
create policy "mentorships_admin_write" on public.mentorships
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- subscriptions/payments: owner may read, admin may read; writes only via service role
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
create policy "payments_select_own" on public.payments
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_admin());
