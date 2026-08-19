-- ============================================================================
-- קוד פתוח — indexes for the hot query shapes.
--
-- Not today's bottleneck (every table is still tiny) — this is the part of the
-- performance plan that keeps the chat unread counter, the conversations list,
-- the reply counts and the jobs board linear-proof on the way to 1,000
-- members. Each shape was taken from a measured query in the app; every
-- statement is IF NOT EXISTS and safe to re-run.
-- ============================================================================

create index if not exists conversations_b_idx on public.conversations (b_id);
create index if not exists conversations_last_message_idx on public.conversations (last_message_at desc);
create index if not exists messages_unread_idx on public.messages (conversation_id, sender_id) where read_at is null;
create index if not exists reactions_profile_kind_idx on public.reactions (profile_id, kind);
create index if not exists saved_jobs_profile_idx on public.saved_jobs (profile_id);
create index if not exists applications_applicant_idx on public.applications (applicant_id);
create index if not exists mentor_requests_profile_kind_idx on public.mentor_requests (profile_id, kind);
create index if not exists jobs_source_status_created_idx on public.jobs (source, status, created_at desc);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at desc);
