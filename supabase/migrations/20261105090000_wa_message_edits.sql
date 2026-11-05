-- ============================================================================
-- WhatsApp: "עריכה" of a sent message (the owner, 5/11: ״תעשה אפשרות עריכה בווצאפ״).
-- Meta's Cloud API cannot change or withdraw a message once it is sent, so an
-- edit from the team inbox goes out as a NEW message quoting the original
-- (the reply context) - the contact sees the correction attached to the
-- message it corrects. edit_of links the correction to the message it replaces,
-- so the thread shows the quote on the correction and a ״תוקנה״ mark on the
-- original.
-- ============================================================================

alter table public.wa_messages
  add column if not exists edit_of uuid references public.wa_messages (id) on delete set null;

create index if not exists wa_messages_edit_of_idx
  on public.wa_messages (edit_of)
  where edit_of is not null;
