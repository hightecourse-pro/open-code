-- Per-session switch for the ״היית איתנו בסשן?״ ask (the owner, 17/11: a Q&A
-- about the course is not a session to rate - ״אני לא רוצה שיהיה עליו משוב״).
-- Default on: every existing session keeps asking exactly as before. Read by
-- the app layout (which session may ask), the feedback action (refuses an
-- answer for a switched-off session) and the admin sessions screen (toggle).
alter table public.sessions
  add column if not exists feedback_enabled boolean not null default true;
