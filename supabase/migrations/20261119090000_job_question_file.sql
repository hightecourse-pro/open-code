-- ============================================================================
-- A document as an application answer (the owner, 19/11: ״תוסיף בהגשה למשרה
-- אפשרות לשאלה עם העלאת מסמך - ושבבחינה תהיה לי תצוגה מקדימה כמו בקורות חיים״).
--
-- job_questions gains the answer type 'file'. The answer itself stays a plain
-- string in applications.answers - `file:<attachment id>` - so every reader of
-- the answers keeps working; the document lives in the private 'attachments'
-- bucket under the applicant's own folder, with an attachments row linked to
-- the application (context 'application'). Members read their own rows, the
-- team reads everything - the existing policy arms.
-- ============================================================================

alter table public.job_questions drop constraint if exists job_questions_answer_type_check;
alter table public.job_questions
  add constraint job_questions_answer_type_check
  check (answer_type in ('paragraph', 'number', 'select', 'multiselect', 'file'));

alter table public.attachments drop constraint if exists attachments_context_check;
alter table public.attachments
  add constraint attachments_context_check
  check (context in ('post', 'comment', 'message', 'request', 'application'));
