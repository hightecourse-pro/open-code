-- ============================================================================
-- Open Code — app_settings (admin-editable global settings)
-- Key/value JSON store. First use: community membership pricing, editable from
-- the admin panel. Readable by everyone (pricing is public); writable by admins.
-- ============================================================================

create table public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

-- Pricing is public info (shown on /join and the marketing site).
create policy "app_settings_select" on public.app_settings
  for select to anon, authenticated using (true);
create policy "app_settings_admin_write" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Seed current pricing: 39 ₪/month, 10% annual discount, 3-month minimum.
insert into public.app_settings (key, value) values
  ('pricing', '{"monthlyAgorot":3900,"annualDiscountPct":10,"minTermMonths":3}'::jsonb)
on conflict (key) do nothing;
