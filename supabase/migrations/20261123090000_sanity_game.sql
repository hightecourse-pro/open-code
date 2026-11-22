-- ============================================================================
-- המסע לאי השפיות (Hightecourse 2026, Thursday 26.11 09:00): the group game of
-- the conference - 30 circles, a tablet per circle, one hall screen and the
-- control room (״הסטודיו״). Rewritten inside the app from the hand-over kit
-- (the owner, 22.11: ״תכתוב מחדש בצורה נכונה ולא סטטית״): every tablet keeps
-- its game on the server too, so a dead tablet is replaced by any other device
-- opening the same address; the hall and the studio read one JSON feed.
--
-- An event (״אירוע״) is one run of the game - the dress rehearsal and the day
-- itself are two rows, each with its own circles and tokens. The tablet of
-- circle N opens /sanity/t/<token>; the token is the only thing that lets a
-- device write that circle. All tables are service-role only (no policies):
-- the API routes are the door.
-- ============================================================================

create table public.sanity_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text not null,
  circles int not null default 30 check (circles between 1 and 60),
  gender text not null default 'm' check (gender in ('m', 'f')),
  active boolean not null default false,
  started_at timestamptz,
  reset_at timestamptz,
  hall_scene text not null default 'auto' check (hall_scene in ('auto', 'map', 'focus', 'compare', 'race', 'stats', 'grand')),
  focus_circle int,
  compare jsonb,
  reveal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sanity_events is 'One run of המסע לאי השפיות: the rehearsal, the conference day. The active one is what the hall screen shows by default.';
-- one active event at a time
create unique index sanity_events_one_active on public.sanity_events (active) where active;

create table public.sanity_circles (
  event_id uuid not null references public.sanity_events(id) on delete cascade,
  circle int not null check (circle between 1 and 60),
  token text not null unique default encode(gen_random_bytes(6), 'hex'),
  version int not null default 0,
  state jsonb,
  snapshot jsonb,
  stage int not null default 0,
  finished boolean not null default false,
  reset_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (event_id, circle)
);
comment on column public.sanity_circles.state is 'The tablet''s whole game, as it saves it (without the forest photo). A replacement device continues from here.';
comment on column public.sanity_circles.snapshot is 'What the hall screen shows: stage, position, tokens, timer end... (engine snapshot()).';
comment on column public.sanity_circles.version is 'Monotonic per circle; a write with an older version than the stored one is refused (another device took over).';

create table public.sanity_creations (
  event_id uuid not null references public.sanity_events(id) on delete cascade,
  circle int not null,
  standing jsonb not null default '[]'::jsonb,
  sentence text not null default '',
  quad jsonb,
  photo_path text,
  photo_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (event_id, circle)
);
comment on table public.sanity_creations is 'The hidden creations of a circle: how many stood per statement (the melody), the safari sentence (the song), the forest photo (the shape).';

alter table public.sanity_events enable row level security;
alter table public.sanity_circles enable row level security;
alter table public.sanity_creations enable row level security;

-- Photos of the forest tiles and the game's licensed font files (Rag Sans:
-- a RAG Studio EULA - the files stay out of the public repo). Private; the
-- app streams both through its own domain.
insert into storage.buckets (id, name, public)
values ('sanity', 'sanity', false)
on conflict (id) do nothing;
