-- ============================================================================
-- קוד פתוח — תיעוד כניסות לתוכן + ניקוי תור השיתופים. להריץ פעם אחת ב-SQL Editor.
--
-- מהיום הגישה לדרייב נפתחת ברגע שחברה מנסה להיכנס לתוכן — ולא בהצטרפות.
-- לכן:
--   1. כל כניסה נרשמת עם הבעלים (קורס/סשן) ולא רק עם הקישור, ושורדת מחיקת קישור.
--   2. שורות "לשתף" שנוצרו בהצטרפות ואף אחת לא ביקשה — נמחקות (הן מעולם לא בוצעו בדרייב).
-- בטוח להריץ שוב.
-- ============================================================================

-- ---------------------------------------------------------------- 1. תיעוד
alter table public.content_views
  add column if not exists owner_type public.content_owner,
  add column if not exists owner_id   uuid,
  add column if not exists source     text;

-- כניסה ברמת הבעלים (סשן/קורס) לא תמיד קשורה לקישור מסוים.
alter table public.content_views alter column link_id drop not null;

-- מילוי לאחור ממה שעוד קיים.
update public.content_views v
   set owner_type = l.owner_type,
       owner_id   = l.owner_id
  from public.content_links l
 where l.id = v.link_id
   and v.owner_id is null;

-- מחיקת קישור לא תמחק את ההיסטוריה (היה on delete cascade).
alter table public.content_views
  drop constraint if exists content_views_link_id_fkey;
alter table public.content_views
  add constraint content_views_link_id_fkey
  foreign key (link_id) references public.content_links (id) on delete set null;

create index if not exists content_views_owner_idx
  on public.content_views (owner_type, owner_id, created_at desc);
create index if not exists content_views_member_time_idx
  on public.content_views (profile_id, created_at desc);

-- ------------------------------------------------- 2. סיכום למסכי הניהול
-- מי נכנסה לאיזה תוכן, מתי לראשונה, מתי לאחרונה וכמה פעמים.
-- security_invoker = false + is_admin() — אותו דפוס כמו sessions_public.
create or replace view public.content_open_stats
with (security_invoker = false) as
  select v.profile_id,
         v.owner_type,
         v.owner_id,
         count(*)::int     as opens,
         min(v.created_at) as first_open,
         max(v.created_at) as last_open
    from public.content_views v
   where v.owner_id is not null
     and public.is_admin()
   group by v.profile_id, v.owner_type, v.owner_id;

grant select on public.content_open_stats to authenticated;

-- --------------------------------------------------- 3. ניקוי תור השיתופים
-- שורות pending נוצרו אבל מעולם לא בוצעו בדרייב — אין מה לבטל, רק למחוק.
-- שומרים בכוונה:
--   granted_manually — האדמינית החליטה עליהן, ומסך הקורסים מציג אותן.
--   granted_email is not null — לא שאריות: אלה שורות שחזרו ל-pending אחרי
--     שינוי כתובת Gmail או הוספת קישור חדש, ומחיקתן תשאיר הרשאה יתומה בדרייב.
delete from public.content_shares
 where status = 'pending'
   and granted_manually = false
   and granted_email is null;
