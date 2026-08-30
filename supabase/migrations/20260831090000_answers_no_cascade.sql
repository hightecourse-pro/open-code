-- Deleting a config question must never silently delete members' answers
-- (the 30/8 question cleanup cascaded into profile_answers — the owner:
-- "כיצד הוא נמחק?"). RESTRICT makes such a delete fail loudly; retiring a
-- question is done with active=false, which keeps every answer.
alter table public.profile_answers
  drop constraint if exists profile_answers_question_id_fkey;
alter table public.profile_answers
  add constraint profile_answers_question_id_fkey
  foreign key (question_id) references public.config_questions(id) on delete restrict;
