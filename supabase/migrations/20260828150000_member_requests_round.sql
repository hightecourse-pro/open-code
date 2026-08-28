-- Shira's inbox round (2026-08-28):
--   * the sent reply is kept on the request, so the team can see what was
--     answered (and that it really went out);
--   * handled_by_name records WHO of the team handled it, picked from a
--     preset list (the admin accounts are shared, so the auth uid isn't the
--     person) — the list itself lives in app_settings under 'team_names'.
alter table public.member_requests add column if not exists reply text;
alter table public.member_requests add column if not exists handled_by_name text;
