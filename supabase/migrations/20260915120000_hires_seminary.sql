-- סמינר על כל גיוס (the owner, 15/9: "בגיוסים תאפשר לעדכן סמינר ושזה יהיה
-- בולט") — distinct from payer_institution (who pays the fee): this is where
-- the hired woman studied, shown prominently and editable on every row.
alter table public.hires add column if not exists seminary text;

-- Backfill from the member's own questionnaire answer where she is linked.
update public.hires h
set seminary = pa.value #>> '{}'
from public.config_questions q
join public.profile_answers pa on pa.question_id = q.id
where q.key = 'study_place'
  and pa.profile_id = h.profile_id
  and h.seminary is null
  and coalesce(pa.value #>> '{}', '') <> '';
