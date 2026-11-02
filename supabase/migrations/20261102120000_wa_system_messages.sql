-- ============================================================================
-- WhatsApp system messages (the owner, 2/11: ״תציג גם הודעות מערכת אצלנו״).
-- Meta's "system" notices - a contact changed her number, a device identity
-- changed - get a kind of their own: the team inbox renders them as a grey
-- centred line (never as a bubble from the contact), they do not mark the
-- conversation unread or awaiting a reply, and they never ring the office mail.
-- ============================================================================

alter table public.wa_messages drop constraint if exists wa_messages_kind_check;
alter table public.wa_messages
  add constraint wa_messages_kind_check
  check (kind in ('text', 'image', 'video', 'audio', 'document', 'sticker', 'template', 'system'));
