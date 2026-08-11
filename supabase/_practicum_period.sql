-- ============================================================================
-- Open Code — practicum period question (run once in the SQL Editor)
-- Seeds the config_questions row for key='practicum_period' — the month-range
-- follow-up the profile wizard renders with its period picker and stores as
-- {"start":"YYYY-MM","end":"YYYY-MM"} (or "end":"current" while she's still
-- in it). Safe to re-run. Already applied to the live DB on 2026-08-10 —
-- there this whole file is a no-op; it exists so a fresh environment gets the
-- question too.
--
-- Notes:
--   * field_type stays 'text' on purpose: select/multiselect questions are
--     offered as chip filters by the portal catalogue
--     (src/lib/portal/candidates.ts), and formatted period strings make no
--     sense as chips — free-text questions are skipped there.
--   * depends_on='practicum_done' — asked only when she answered that she did
--     a practicum; when hidden it is neither required, validated nor saved.
--   * required=true — the owner's rule: when she did a practicum, start+end
--     month/year are mandatory ("עוד לא סיימתי" counts as an end).
--   * employer_visible=true — the portal shows it as "תקופת הפרקטיקום",
--     matching the rest of the practicum block.
-- ============================================================================

-- Right after "איפה?" (practicum_employer), wherever that currently sorts.
insert into public.config_questions
  (key, label_he, field_type, required, sort_order, scope, intake_track, depends_on, employer_visible, options)
select
  'practicum_period',
  'מתי? (חודש ושנה — התחלה וסיום)',
  'text',
  true,
  coalesce((select sort_order + 1 from public.config_questions where key = 'practicum_employer'), 52),
  'junior',
  'junior',
  'practicum_done',
  true,
  '[]'::jsonb
on conflict (key) do nothing;

-- Nudge the rest of the practicum block down only when the new row actually
-- collided with it (fresh environments); a custom admin ordering — and the
-- live DB, already renumbered — are left alone. Each shift fires only on an
-- exact collision, so re-runs are no-ops.
update public.config_questions set sort_order = sort_order + 1
  where key = 'practicum_tech'
    and sort_order = (select sort_order from public.config_questions where key = 'practicum_period');
update public.config_questions set sort_order = sort_order + 1
  where key = 'practicum_description'
    and sort_order = (select sort_order from public.config_questions where key = 'practicum_tech');
update public.config_questions set sort_order = sort_order + 1
  where key = 'practical_experience'
    and sort_order = (select sort_order from public.config_questions where key = 'practicum_description');

-- (idempotent) ensure the behavioral flags hold even if the row already
-- existed from an earlier partial run. Label is deliberately NOT enforced —
-- it stays editable in the admin questions screen.
update public.config_questions
  set depends_on = 'practicum_done', intake_track = 'junior',
      employer_visible = true, required = true
  where key = 'practicum_period';
