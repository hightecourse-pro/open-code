-- משובים על ההאקתון (the owner, 6.11): what members, judges and guests said about the hackathon
-- and its finals event, gathered from the staff chats, the WhatsApp inbox, the forum, the
-- ״יש לך בקשה?״ form, the submission's personal answers, the review-request replies and mail -
-- one row per quote, with its source, so the admin's member page and the submission's card
-- can list them and the PDF can be built from the same rows. Written by tools and server
-- actions only (service role); no member ever reads this table.
create table if not exists public.hackathon_feedback_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  team_key text,
  display_name text not null,
  audience text not null default 'other' check (audience in ('submitter', 'participant', 'other')),
  source text not null check (source in ('chat', 'whatsapp', 'forum', 'request', 'submission', 'review', 'email', 'manual')),
  source_ref text,
  source_url text,
  kind text not null default 'borderline' check (kind in ('praise', 'criticism', 'suggestion', 'mixed', 'reflection', 'borderline')),
  topic text,
  body text not null,
  written_at timestamptz not null,
  hidden_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hackathon_feedback_notes_source_ref_idx on public.hackathon_feedback_notes (source, source_ref) where source_ref is not null;
create index if not exists hackathon_feedback_notes_profile_idx on public.hackathon_feedback_notes (profile_id);
create index if not exists hackathon_feedback_notes_team_idx on public.hackathon_feedback_notes (team_key);

alter table public.hackathon_feedback_notes enable row level security;
-- No policies on purpose: the service role (admin pages, tools) is the only reader and writer.
