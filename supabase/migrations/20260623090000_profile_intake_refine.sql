-- ============================================================================
-- Open Code — Phase 4b: profile intake refinements (run in the SQL Editor)
-- Safe to re-run. Adjusts the dynamic profile questions per the community's
-- real intake form: shared maintained lists (technologies, regions), new
-- multi-select fields, conditional "אם כן" follow-ups, and tidied options.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. config_questions: support taxonomy-sourced options + conditional fields
-- ---------------------------------------------------------------------------
alter table public.config_questions
  add column if not exists taxonomy_kind public.taxonomy_kind,
  add column if not exists depends_on text;

-- ---------------------------------------------------------------------------
-- 2. Regions: keep only צפון / דרום / מרכז / ירושלים והסביבה
--    (the region question now reads its options from this maintained list)
-- ---------------------------------------------------------------------------
update public.config_taxonomies set active = false
  where kind = 'region' and value in ('sharon', 'shfela', 'remote');
update public.config_taxonomies set active = true
  where kind = 'region' and value in ('center', 'north', 'south', 'jerusalem');

update public.config_questions set taxonomy_kind = 'region', required = true where key = 'region';

-- ---------------------------------------------------------------------------
-- 3. Marital status: רווקה / נשואה / מאורסת / אחר
-- ---------------------------------------------------------------------------
update public.config_questions
  set options = '[{"value":"single","label":"רווקה"},{"value":"married","label":"נשואה"},{"value":"engaged","label":"מאורסת"},{"value":"other","label":"אחר"}]'::jsonb,
      required = false
  where key = 'marital_status';

-- ---------------------------------------------------------------------------
-- 4. Track: replace "מגמה" with "התמחות ספציפית במגמה" (multi-select), and add
--    "קורסים ייחודיים במגמה". Both maintainable in Admin → Configuration.
-- ---------------------------------------------------------------------------
update public.config_questions set active = false where key = 'track';

update public.config_questions
  set label_he = 'התמחות ספציפית במגמה',
      field_type = 'multiselect',
      sort_order = 21,
      required = true,
      taxonomy_kind = null,
      options = '[{"value":"ai","label":"בינה מלאכותית"},{"value":"hardware","label":"חומרה ושבבים"},{"value":"lev","label":"מכון לב"},{"value":"cyber","label":"סייבר"},{"value":"devops","label":"DevOps"},{"value":"fullstack","label":"פולסטאק"}]'::jsonb
  where key = 'track_specialization';

insert into public.config_questions (key, label_he, field_type, required, sort_order, scope, options) values
  ('unique_courses', 'קורסים ייחודיים במגמה', 'multiselect', false, 22, 'junior',
    '[{"value":"salesforce","label":"Salesforce"},{"value":"qa","label":"בדיקות / QA"},{"value":"automation_dev","label":"פיתוח אוטומציה"},{"value":"biz_automation","label":"אוטומציה עסקית"},{"value":"n8n","label":"n8n"},{"value":"agents","label":"פיתוח אייג''נטים"}]'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Certificate: multi-select with the real options
-- ---------------------------------------------------------------------------
update public.config_questions
  set field_type = 'multiselect',
      required = true,
      options = '[{"value":"mahat","label":"הנדסאי מה\"ט"},{"value":"moe","label":"הנדסאי משרד החינוך"},{"value":"degree","label":"תואר"},{"value":"qa","label":"בדיקות תוכנה"},{"value":"salesforce","label":"יישום Salesforce"},{"value":"other","label":"אחר"}]'::jsonb
  where key = 'certificate';

-- ---------------------------------------------------------------------------
-- 6. Coordinator: keep name only (drop phone + email)
-- ---------------------------------------------------------------------------
update public.config_questions set active = false where key in ('coordinator_phone', 'coordinator_email');

-- ---------------------------------------------------------------------------
-- 7. Graduation year: Hebrew year picker
-- ---------------------------------------------------------------------------
update public.config_questions
  set field_type = 'select',
      label_he = 'שנת סיום לימודים',
      options = '[{"value":"5786","label":"תשפ\"ו"},{"value":"5785","label":"תשפ\"ה"},{"value":"5784","label":"תשפ\"ד"},{"value":"5783","label":"תשפ\"ג"},{"value":"other","label":"אחר"}]'::jsonb
  where key = 'graduation_year';

-- ---------------------------------------------------------------------------
-- 8. Study place: select with "אחר" (institution list to be maintained in admin)
-- ---------------------------------------------------------------------------
update public.config_questions
  set field_type = 'select',
      required = false,
      options = '[{"value":"other","label":"אחר"}]'::jsonb
  where key = 'study_place';

-- ---------------------------------------------------------------------------
-- 9. Technologies: every tech field reads the same maintained 'tech' list
-- ---------------------------------------------------------------------------
update public.config_questions
  set label_he = 'אילו טכנולוגיות פיתוח התנסית בפועל בעבודה/בוטקאמפ? (רק כאלה שבאמת התנסית בהן)',
      field_type = 'multiselect',
      taxonomy_kind = 'tech',
      required = true,
      sort_order = 30
  where key = 'dev_tech';

update public.config_questions
  set field_type = 'multiselect', taxonomy_kind = 'tech', required = false
  where key in ('genai_known', 'genai_practiced');

update public.config_questions
  set field_type = 'multiselect', taxonomy_kind = 'tech', required = false, depends_on = 'practicum_done'
  where key = 'practicum_tech';

-- ---------------------------------------------------------------------------
-- 10. AI tools used: maintained list with "אחר"
-- ---------------------------------------------------------------------------
update public.config_questions
  set field_type = 'multiselect',
      required = false,
      options = '[{"value":"cursor","label":"Cursor"},{"value":"claude_code","label":"Claude Code"},{"value":"kiro","label":"Kiro"},{"value":"amazon_q","label":"Amazon Q"},{"value":"copilot","label":"GitHub Copilot"},{"value":"other","label":"אחר"}]'::jsonb
  where key = 'ai_tools_used';

-- ---------------------------------------------------------------------------
-- 11. AI project links: a (non-mandatory) list
-- ---------------------------------------------------------------------------
update public.config_questions
  set label_he = 'קישורים לפרויקטי AI שעשית (אפשר כמה — שורה לכל קישור)', required = false
  where key = 'ai_project_links';

-- ---------------------------------------------------------------------------
-- 12. "אם כן" follow-ups appear only when the practicum answer is yes
-- ---------------------------------------------------------------------------
update public.config_questions set depends_on = 'practicum_done', required = false
  where key = 'practicum_employer';

-- ---------------------------------------------------------------------------
-- 13. Placement preferences: practicum (2 options) + hybrid commute (3 options)
-- ---------------------------------------------------------------------------
update public.config_questions
  set field_type = 'select',
      required = false,
      options = '[{"value":"immediate_only","label":"לא, רק אם זו השמה מיידית אני מעוניינת"},{"value":"yes_3m","label":"כן, שווה לי לעבוד 3 חודשים בחינם אם יש השמה בסוף"}]'::jsonb
  where key = 'practicum_placement';

update public.config_questions
  set field_type = 'select',
      required = false,
      options = '[{"value":"yes_any","label":"כן, אעשה כל מאמץ"},{"value":"yes_2_3","label":"כן, רק אם זה פעמיים-שלוש בשבוע"},{"value":"no","label":"לא מתאים לתנאי החיים שלי"}]'::jsonb
  where key = 'remote_commute';

-- ---------------------------------------------------------------------------
-- 14. Required-field policy (logic applied; tweak any from Admin later)
-- ---------------------------------------------------------------------------
update public.config_questions set required = true
  where key in ('id_number', 'phone');
update public.config_questions set required = false
  where key in ('prev_surname', 'city', 'coordinator_name', 'ai_gaps', 'genai_known',
                'genai_practiced', 'practicum_done', 'paid_placement', 'notes_for_us');
