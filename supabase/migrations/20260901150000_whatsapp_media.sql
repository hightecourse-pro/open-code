-- ============================================================================
-- WhatsApp media round (the owner, 1/9): "להתנהל כמו ווצאפ רגיל" — images,
-- video, audio/voice notes, documents, plus template-opened conversations.
-- Inbound media is copied into a PRIVATE bucket (Meta's media links expire);
-- the admin screen serves it with short-lived signed URLs.
-- ============================================================================

alter table public.wa_messages
  add column if not exists kind text not null default 'text'
    check (kind in ('text', 'image', 'video', 'audio', 'document', 'sticker', 'template')),
  add column if not exists media_path text,
  add column if not exists media_mime text,
  add column if not exists filename   text,
  add column if not exists template_params jsonb;

insert into storage.buckets (id, name, public)
values ('wa-media', 'wa-media', false)
on conflict (id) do nothing;
