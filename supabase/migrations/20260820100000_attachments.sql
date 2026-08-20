-- ============================================================================
-- קוד פתוח — צרופות ותמונות בפורום ובצ'אט.
--
-- The CV pipeline's recipe, applied to community content: a PRIVATE bucket,
-- reads only through short-lived signed URLs minted server-side, uploads only
-- into the uploader's own folder. A public URL in a closed community is a
-- leak; none exist here.
--
-- The metadata table is polymorphic (post / comment / message). A row is born
-- UNLINKED (context_id null) while she is still composing, and the create
-- action stamps the context on send — the nightly cron sweeps unlinked rows
-- older than a day, so an abandoned draft never strands a file.
-- ============================================================================

-- ---- the bucket, shaped like cvs: private, capped, typed --------------------
do $$
begin
  insert into storage.buckets (id, name) values ('attachments', 'attachments')
    on conflict (id) do nothing;

  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'public') then
    update storage.buckets set public = false where id = 'attachments';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    update storage.buckets
       set file_size_limit = 10485760,  -- 10 MB hard cap; the app holds images to 5 MB
           allowed_mime_types = array[
             'image/png', 'image/jpeg', 'image/webp', 'image/gif',
             'application/pdf',
             'application/msword',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
           ]
     where id = 'attachments';
  end if;
end $$;

-- Uploads go into the uploader's own folder; there is deliberately NO select
-- policy — every read is a signed URL the server mints after its own checks.
drop policy if exists "attachments_owner_insert" on storage.objects;
create policy "attachments_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "attachments_owner_delete" on storage.objects;
create policy "attachments_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---- the metadata ----------------------------------------------------------
create table if not exists public.attachments (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  context     text check (context in ('post', 'comment', 'message')),
  context_id  uuid,
  file_path   text not null,
  file_name   text not null,
  mime        text not null,
  size_bytes  bigint not null,
  created_at  timestamptz not null default now()
);

create index if not exists attachments_context_idx on public.attachments (context, context_id);
create index if not exists attachments_unlinked_idx on public.attachments (created_at)
  where context_id is null;

alter table public.attachments enable row level security;

-- She sees her own rows (composing), members see what hangs on community
-- content, a message's files are for its two participants only.
drop policy if exists "attachments_select" on public.attachments;
create policy "attachments_select" on public.attachments for select to authenticated
  using (
    profile_id = ( select auth.uid() )
    or ( select public.is_admin() )
    or (context in ('post', 'comment') and ( select public.is_member() ))
    or (
      context = 'message'
      and exists (
        select 1
        from public.messages m
        join public.conversations c on c.id = m.conversation_id
        where m.id = attachments.context_id
          and ( select auth.uid() ) in (c.a_id, c.b_id)
      )
    )
  );

drop policy if exists "attachments_insert_own" on public.attachments;
create policy "attachments_insert_own" on public.attachments for insert to authenticated
  with check (profile_id = ( select auth.uid() ));

drop policy if exists "attachments_delete_own" on public.attachments;
create policy "attachments_delete_own" on public.attachments for delete to authenticated
  using (profile_id = ( select auth.uid() ) or ( select public.is_admin() ));
