-- ============================================================================
-- Open Code — קורות חיים "ברירת מחדל" לכל חברה.
-- Run once in the SQL Editor. Safe to re-run.
--
-- עד כה ההגשה צירפה תמיד את הקובץ האחרון שהועלה — כלומר קו״ח שהותאמו למשרה
-- אחרת יכלו להגיע ללקוח במקום הגרסה הראשית שלה. הטור הזה נותן לחברה לסמן
-- במפורש איזה קובץ הוא שלה כברירת מחדל, ואינדקס חלקי ייחודי מבטיח שיהיה
-- לכל היותר אחד כזה לכל חברה.
--
-- הקוד עובד גם לפני ההרצה (הוא נופל בחזרה ל"האחרון שהועלה"), אז אפשר לפרוס
-- קודם ולהריץ אחר כך.
-- ============================================================================

alter table public.cv_documents
  add column if not exists is_default boolean not null default false;

-- At most one default per member.
create unique index if not exists cv_documents_one_default_idx
  on public.cv_documents (profile_id)
  where is_default;

-- Backfill: whoever has documents but no default yet gets her newest one.
update public.cv_documents d
   set is_default = true
 where d.id in (
   select distinct on (c.profile_id) c.id
     from public.cv_documents c
    where not exists (
      select 1 from public.cv_documents x
       where x.profile_id = c.profile_id and x.is_default
    )
    order by c.profile_id, c.created_at desc, c.id desc
 );

-- RLS needs nothing new: cv_documents_owner (phase4) is already `for all`
-- with profile_id = auth.uid(), so a member may flip her own flag.
