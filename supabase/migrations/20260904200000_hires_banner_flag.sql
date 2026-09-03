-- Per-hire banner opt-out (the owner, 3/9): a placement stays in the registry
-- but can leave the celebration banner.
alter table public.hires add column if not exists show_in_banner boolean not null default true;
