-- ============================================================================
-- Open Code — per-user AI keys (BYO Google Gemini key)
-- Each member adds and manages her own Google API key. Stored encrypted
-- (AES-256-GCM, app-level, via AI_KEY_SECRET) — the DB never holds plaintext.
-- Owner-only RLS; not even admins can read another member's key.
-- ============================================================================

create table public.user_ai_keys (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  provider     text not null default 'google',
  label        text,
  key_cipher   text not null,          -- AES-256-GCM ciphertext (iv.tag.data)
  key_last4    text,                   -- for masked display only
  status       text not null default 'active', -- active | exhausted | invalid
  last_error   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index user_ai_keys_owner_idx on public.user_ai_keys (profile_id, created_at desc);

alter table public.user_ai_keys enable row level security;

-- Strictly owner-only — no admin override (these are personal credentials).
create policy "user_ai_keys_owner_all" on public.user_ai_keys for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
