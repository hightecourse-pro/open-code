-- ============================================================================
-- Internal member tags (the owner, 2/9): "מפתחת AI ללקוח אמיתי" /
-- "מפתחת AI לפרויקטים עצמאיים" — saved on HER (member_crm, admin-only),
-- never shown to members or clients. text[] so more tags can join later.
-- ============================================================================

alter table public.member_crm
  add column if not exists internal_tags text[] not null default '{}';
