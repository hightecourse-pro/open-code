-- Form drafts on the server (the member Shoshana Ben-Haim, 14.11: ״שמירת
-- הטיוטות בהגשה למשרות היא רק על אותו מחשב״; the owner, 19.11: ״תבנה״).
-- Until now a half-filled form lived only in that browser's localStorage.
-- One row per member and form key (״draft:apply:<job id>״): the same snapshot
-- the browser keeps, so the next device picks it up. Her rows only.
create table if not exists public.form_drafts (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  key         text not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (profile_id, key)
);

alter table public.form_drafts enable row level security;

create policy "form_drafts_select_own" on public.form_drafts
  for select using (auth.uid() = profile_id);
create policy "form_drafts_insert_own" on public.form_drafts
  for insert with check (auth.uid() = profile_id);
create policy "form_drafts_update_own" on public.form_drafts
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "form_drafts_delete_own" on public.form_drafts
  for delete using (auth.uid() = profile_id);
