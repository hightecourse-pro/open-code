-- ״מסך אחורה״ in the studio (the owner, 25.11, the night before the conference: ״שבקונטרול יוכלו להחזיר פעולה אחת
-- אחורה״): the last saved games of a circle, newest last, so the control room can take a wrong tap back one screen
-- at a time. Every tablet save that changes the phase pushes the previous {state, snapshot} (up to 8 kept); the
-- studio's undo pops one and bumps the version so the tablet adopts it; a reset clears the list.
alter table public.sanity_circles add column if not exists history jsonb not null default '[]'::jsonb;
comment on column public.sanity_circles.history is 'The last saved {state, snapshot} pairs of the circle (up to 8, newest last) - the studio''s ״מסך אחורה״ restores one and the tablet adopts it.';
