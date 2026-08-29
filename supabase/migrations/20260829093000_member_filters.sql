-- The admin candidate-finder used to preload EVERY profile_answers row
-- (members × questions — ~90k rows at 3,000 members) so the browser could
-- filter. These two predicates move the matching into SQL: the client sends
-- the selected criteria, the database answers with member ids.
create or replace function public.match_answer_ids(p_question uuid, p_values text[])
returns table (profile_id uuid)
language sql
security definer
set search_path = ''
as $$
  select a.profile_id
  from public.profile_answers a
  where a.question_id = p_question
    and (
      (jsonb_typeof(a.value) = 'array'
        and exists (select 1 from jsonb_array_elements_text(a.value) t(v) where t.v = any (p_values)))
      or (jsonb_typeof(a.value) = 'string' and (a.value #>> '{}') = any (p_values))
      or (jsonb_typeof(a.value) in ('number', 'boolean') and a.value::text = any (p_values))
    );
$$;
revoke all on function public.match_answer_ids(uuid, text[]) from public, anon, authenticated;
grant execute on function public.match_answer_ids(uuid, text[]) to service_role;

create or replace function public.match_answer_text(p_question uuid, p_needle text)
returns table (profile_id uuid)
language sql
security definer
set search_path = ''
as $$
  select a.profile_id
  from public.profile_answers a
  where a.question_id = p_question
    and a.value::text ilike '%' || trim(p_needle) || '%';
$$;
revoke all on function public.match_answer_text(uuid, text) from public, anon, authenticated;
grant execute on function public.match_answer_text(uuid, text) to service_role;
