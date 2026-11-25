-- The owner's wording edits, made inside the game itself (26.11, the night before the conference: ״כרטיס שנראה בדיוק
-- כמו במשחק רק שאני לוחץ על טקסט אני משנה״). The tablet page in edit mode (/sanity/t/<token>?edit=1, behind the
-- studio's door) marks every text with its content path; a change is kept here until Claude moves it into the code.
-- kind 'text': key = the content path (UI.welcome.title), original + text; 'screen': key = the screen the owner
-- went through (phase[:zone]); 'note': key = a note id, text = her general instruction.
create table public.sanity_text_edits (
  key text primary key,
  kind text not null check (kind in ('text', 'screen', 'note')),
  original text,
  text text,
  screen text,
  updated_at timestamptz not null default now()
);
comment on table public.sanity_text_edits is 'The owner''s wording edits from the game''s edit mode (text), the screens she went through (screen) and her notes (note) - read by Claude, never by the game itself.';
alter table public.sanity_text_edits enable row level security;
