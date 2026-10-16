-- Online presence (the owner, 16/10): the app sends a heartbeat while she is
-- active, and every member row carries when she was last seen. "מחוברת עכשיו"
-- = seen in the last 5 minutes (green dot); otherwise orange with "נראתה לפני…".
alter table public.profiles add column if not exists last_seen_at timestamptz;
create index if not exists profiles_last_seen_at_idx on public.profiles (last_seen_at desc nulls last);
