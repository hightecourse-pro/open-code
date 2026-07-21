-- ============================================================================
-- QA 2026-07-21 — תיקוני SQL מסקירת ה-QA המקיפה. להרצה ב-SQL Editor.
-- בטוח להרצה חוזרת.
-- ============================================================================

-- 1) שלוש שאלות שלא נכון לחשוף למעסיקים בפורטל (הפיך ממסך הקונפיגורציה):
--    paid_placement — מודל עסקי פנימי; specific_job — התאמה פנימית שלנו;
--    ai_gaps — חולשה שהמועמדת שיתפה בכנות, להציגה למעסיק פוגע בה.
update public.config_questions
set employer_visible = false
where key in ('paid_placement', 'specific_job', 'ai_gaps');

-- 2) צ'אט: שליחת הודעה דורשת מנוי פעיל גם ברמת ה-RLS.
--    בלי זה, חברה שהמנוי שלה נגמר יכולה לשלוח הודעות ישירות דרך ה-API
--    (הקוד חוסם, אבל ה-DB חייב לאכוף בעצמו).
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.in_conversation(conversation_id)
    and public.has_active_sub()
  );
