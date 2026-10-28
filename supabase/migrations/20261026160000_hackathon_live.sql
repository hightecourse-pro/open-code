-- גמר ההאקתון בשידור חי (the owner, 26/10): the voting system of the finals
-- evening lives on our own domain - the control panel (question order, the
-- weights), the hall screen (/live) and the judges' page (/live/judge/<token>).
-- The audience votes by phone through Yemot Hamashiach: the server polls the
-- extension's ApprovalAll.ymgr (one fetch per 1.5s, claimed through
-- poll_claimed_at so many open screens share one poll) and stores every
-- keypress once, by its line key. All tables are service-role only.

create table public.hackathon_live_settings (
  id int primary key default 1 check (id = 1),
  event_name text not null default 'האקתון AI קוד פתוח 2026',
  phone_display text not null default '',
  yemot_token text not null default '',
  yemot_extension text not null default '',
  weights_judges int not null default 70 check (weights_judges between 0 and 100),
  audience_mode text not null default 'leader' check (audience_mode in ('leader', 'share')),
  reveal text not null default 'live' check (reveal in ('live', 'end')),
  criteria jsonb not null default '[
    {"key":"works","label":"עובד מקצה לקצה","weight":25,"hint":"התסריט המלא רץ, בלי נפילות"},
    {"key":"correctness","label":"נכונות ואמינות","weight":25,"hint":"עונה שלא יודע כשאין מידע, ולא ממציא"},
    {"key":"problem","label":"פתרון לבעיה האמיתית","weight":15,"hint":"המוצר עונה למה שהארגון ביקש"},
    {"key":"architecture","label":"ארכיטקטורה של פיתוח AI","weight":10,"hint":"איך המערכת בנויה, והאם הצוות יודע להסביר"},
    {"key":"ux","label":"חוויית משתמש","weight":10,"hint":"נעים ונוח להשתמש, העיצוב"},
    {"key":"original","label":"פיצ׳ר מקורי","weight":15,"hint":"חדשנות וחשיבה יצירתית"}
  ]'::jsonb,
  active_challenge text,
  theme text not null default 'light' check (theme in ('light', 'dark')),
  poll_claimed_at timestamptz,
  last_poll_at timestamptz,
  poll_error text,
  calls_claimed_at timestamptz,
  connected int,
  updated_at timestamptz not null default now()
);
insert into public.hackathon_live_settings (id) values (1);

create table public.hackathon_live_challenges (
  key text primary key,
  name text not null,
  org text not null default '',
  logos jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  status text not null default 'idle' check (status in ('idle', 'judging', 'closed')),
  revealed boolean not null default false,
  current_finalist_id uuid,
  question_id uuid,
  updated_at timestamptz not null default now()
);
insert into public.hackathon_live_challenges (key, name, org, logos, sort) values
  ('strauss', 'יועץ הרכב של שטראוס', 'שטראוס', '["/hackathon-2026/logo-strauss.png"]'::jsonb, 1),
  ('virology', 'המעבדה המרכזית לנגיפים', 'משרד הבריאות', '["/hackathon-2026/logo-moh.jpg","/hackathon-2026/logo-virology.png"]'::jsonb, 2),
  ('phoenix', 'הבוט של הפניקס', 'הפניקס', '["/hackathon-2026/logo-phoenix.png"]'::jsonb, 3);

create table public.hackathon_live_finalists (
  id uuid primary key default gen_random_uuid(),
  challenge_key text not null references public.hackathon_live_challenges(key) on delete cascade,
  n int not null check (n between 1 and 9),
  name text not null,
  team text not null default '',
  team_key text,
  created_at timestamptz not null default now(),
  unique (challenge_key, n)
);

create table public.hackathon_live_judges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  challenge_key text references public.hackathon_live_challenges(key) on delete set null,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.hackathon_live_scores (
  judge_id uuid not null references public.hackathon_live_judges(id) on delete cascade,
  finalist_id uuid not null references public.hackathon_live_finalists(id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (judge_id, finalist_id)
);

create table public.hackathon_live_questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  options jsonb not null default '[]'::jsonb,
  sort int not null default 0,
  challenge_key text references public.hackathon_live_challenges(key) on delete set null,
  status text not null default 'idle' check (status in ('idle', 'open', 'closed')),
  reveal text not null default 'live' check (reveal in ('live', 'end')),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.hackathon_live_challenges
  add constraint hackathon_live_challenges_question_fk foreign key (question_id) references public.hackathon_live_questions(id) on delete set null;

-- one row per keypress line in the Yemot file (phone|date|time|digit); the
-- question that was open when the line was first seen, null = late/stale
create table public.hackathon_live_votes (
  key text primary key,
  question_id uuid references public.hackathon_live_questions(id) on delete cascade,
  phone text not null,
  digit int not null,
  voted_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index hackathon_live_votes_question_idx on public.hackathon_live_votes (question_id, phone, voted_at);

alter table public.hackathon_live_settings enable row level security;
alter table public.hackathon_live_challenges enable row level security;
alter table public.hackathon_live_finalists enable row level security;
alter table public.hackathon_live_judges enable row level security;
alter table public.hackathon_live_scores enable row level security;
alter table public.hackathon_live_questions enable row level security;
alter table public.hackathon_live_votes enable row level security;
