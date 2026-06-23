-- ============================================================================
-- Open Code — Phase 4b: full profile intake (run once in the SQL Editor)
-- Safe to re-run. Implements the real community intake form, including the
-- branch for experienced members (≥1yr) who answer a different question set.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. config_questions: taxonomy-sourced options, conditional + track support
-- ---------------------------------------------------------------------------
alter table public.config_questions
  add column if not exists taxonomy_kind public.taxonomy_kind,
  add column if not exists depends_on text,
  add column if not exists intake_track text not null default 'both'; -- both | junior | experienced

-- ---------------------------------------------------------------------------
-- 2. Experience gate — asked to everyone, first. "Yes" branches to the
--    experienced question set; "No" shows the junior (bootcamp) set.
-- ---------------------------------------------------------------------------
insert into public.config_questions (key, label_he, field_type, required, sort_order, scope, intake_track, options) values
  ('has_experience', 'יש לך ניסיון אמיתי בתעשייה (מעל שנה)?', 'bool', false, 1, 'junior', 'both', '[]'::jsonb)
on conflict (key) do nothing;

-- Drop the redundant generic "מה התחום שלך?" question.
update public.config_questions set active = false where key = 'specialization';

-- ---------------------------------------------------------------------------
-- 3. Regions: keep only צפון / דרום / מרכז / ירושלים והסביבה
-- ---------------------------------------------------------------------------
update public.config_taxonomies set active = false
  where kind = 'region' and value in ('sharon', 'shfela', 'remote');
update public.config_taxonomies set active = true
  where kind = 'region' and value in ('center', 'north', 'south', 'jerusalem');
update public.config_questions set taxonomy_kind = 'region', required = true where key = 'region';

-- ---------------------------------------------------------------------------
-- 4. Shared fields (both tracks) — contact, place, certificate, AI, placement
-- ---------------------------------------------------------------------------
update public.config_questions set required = true,  intake_track = 'both' where key in ('id_number', 'phone', 'city');
update public.config_questions set required = false, intake_track = 'both' where key in ('coordinator_name', 'genai_known', 'notes_for_us');

-- study place: maintained list + "אחר" (required)
update public.config_questions
  set field_type = 'select', required = true, intake_track = 'both',
      options = '[{"value":"wolf","label":"הרב וולף"},{"value":"hadash_jlm","label":"החדש ירושלים"},{"value":"hadash_beitar","label":"החדש ביתר"},{"value":"bnot_elisheva","label":"בנות אלישבע"},{"value":"yashan_jlm","label":"הישן ירושלים"},{"value":"yashan_beitar","label":"הישן ביתר"},{"value":"kahana","label":"כהנא"},{"value":"sharansky","label":"הרב שרנסקי"},{"value":"beit_hamore","label":"בית המורה"},{"value":"rechasim","label":"סמינר רכסים"},{"value":"gur_jlm","label":"גור ירושלים"},{"value":"darkei_chana_elad","label":"דרכי חנה אלעד"},{"value":"darkei_rachel_jlm","label":"הסניף ירושלים - דרכי רחל"},{"value":"other","label":"אחר"}]'::jsonb
  where key = 'study_place';

-- certificate: multi-select (both)
update public.config_questions
  set field_type = 'multiselect', required = true, intake_track = 'both',
      options = '[{"value":"mahat","label":"הנדסאי מה\"ט"},{"value":"moe","label":"הנדסאי משרד החינוך"},{"value":"degree","label":"תואר"},{"value":"qa","label":"בדיקות תוכנה"},{"value":"salesforce","label":"יישום Salesforce"},{"value":"other","label":"אחר"}]'::jsonb
  where key = 'certificate';

-- AI tools used: maintained list + "אחר" (both)
update public.config_questions
  set field_type = 'multiselect', required = false, intake_track = 'both',
      options = '[{"value":"cursor","label":"Cursor"},{"value":"claude_code","label":"Claude Code"},{"value":"kiro","label":"Kiro"},{"value":"amazon_q","label":"Amazon Q"},{"value":"copilot","label":"GitHub Copilot"},{"value":"other","label":"אחר"}]'::jsonb
  where key = 'ai_tools_used';

-- GenAI known: multi from the shared tech list (both)
update public.config_questions
  set field_type = 'multiselect', taxonomy_kind = 'tech', required = false, intake_track = 'both'
  where key = 'genai_known';

-- hybrid commute (3 options) + paid placement — both tracks, required
update public.config_questions
  set field_type = 'select', required = true, intake_track = 'both',
      options = '[{"value":"yes_any","label":"כן, אעשה כל מאמץ"},{"value":"yes_2_3","label":"כן, רק אם זה פעמיים-שלוש בשבוע"},{"value":"no","label":"לא מתאים לתנאי החיים שלי"}]'::jsonb
  where key = 'remote_commute';
update public.config_questions set required = true, intake_track = 'both' where key = 'paid_placement';

-- coordinator: keep name only
update public.config_questions set active = false where key in ('coordinator_phone', 'coordinator_email');

-- ---------------------------------------------------------------------------
-- 5. Junior (bootcamp) track — hidden for experienced members
-- ---------------------------------------------------------------------------
update public.config_questions set intake_track = 'junior'
  where key in ('marital_status', 'prev_surname', 'track_specialization', 'unique_courses',
                'graduation_year', 'dev_tech', 'genai_practiced', 'ai_project_links', 'ai_gaps',
                'practicum_done', 'practicum_employer', 'practicum_tech', 'practicum_placement');

-- marital status (required)
update public.config_questions
  set required = true,
      options = '[{"value":"single","label":"רווקה"},{"value":"married","label":"נשואה"},{"value":"engaged","label":"מאורסת"},{"value":"other","label":"אחר"}]'::jsonb
  where key = 'marital_status';

-- "מגמה" → "התמחות ספציפית במגמה" (multi) + "קורסים ייחודיים במגמה" (multi, required)
update public.config_questions set active = false where key = 'track';
update public.config_questions
  set label_he = 'התמחות ספציפית במגמה', field_type = 'multiselect', sort_order = 21, required = true, taxonomy_kind = null,
      options = '[{"value":"ai","label":"בינה מלאכותית"},{"value":"hardware","label":"חומרה ושבבים"},{"value":"lev","label":"מכון לב"},{"value":"cyber","label":"סייבר"},{"value":"devops","label":"DevOps"},{"value":"fullstack","label":"פולסטאק"}]'::jsonb
  where key = 'track_specialization';
update public.config_questions
  set required = true,
      options = '[{"value":"salesforce","label":"Salesforce"},{"value":"qa","label":"בדיקות / QA"},{"value":"automation_dev","label":"פיתוח אוטומציה"},{"value":"biz_automation","label":"אוטומציה עסקית"},{"value":"n8n","label":"n8n"},{"value":"agents","label":"פיתוח אייג''נטים"}]'::jsonb
  where key = 'unique_courses';

-- graduation year (Hebrew picker)
update public.config_questions
  set field_type = 'select', label_he = 'שנת סיום לימודים',
      options = '[{"value":"5786","label":"תשפ\"ו"},{"value":"5785","label":"תשפ\"ה"},{"value":"5784","label":"תשפ\"ד"},{"value":"5783","label":"תשפ\"ג"},{"value":"other","label":"אחר"}]'::jsonb
  where key = 'graduation_year';

-- bootcamp technologies (from shared tech list)
update public.config_questions
  set label_he = 'אילו טכנולוגיות פיתוח התנסית בפועל בבוטקאמפ? (רק כאלה שבאמת התנסית בהן)',
      field_type = 'multiselect', taxonomy_kind = 'tech', required = true, sort_order = 30
  where key = 'dev_tech';
update public.config_questions
  set field_type = 'multiselect', taxonomy_kind = 'tech', required = false
  where key = 'genai_practiced';
update public.config_questions
  set label_he = 'קישורים לפרויקטי AI שעשית (אפשר כמה — שורה לכל קישור)', required = false
  where key = 'ai_project_links';

-- practicum (+ conditional "אם כן" follow-ups) and 2-option practicum placement
update public.config_questions set depends_on = 'practicum_done', required = false
  where key in ('practicum_employer', 'practicum_tech');
update public.config_questions
  set field_type = 'multiselect', taxonomy_kind = 'tech'
  where key = 'practicum_tech';
update public.config_questions
  set field_type = 'select', required = true,
      options = '[{"value":"immediate_only","label":"לא, רק אם זו השמה מיידית אני מעוניינת"},{"value":"yes_3m","label":"כן, שווה לי לעבוד 3 חודשים בחינם אם יש השמה בסוף"}]'::jsonb
  where key = 'practicum_placement';

-- ---------------------------------------------------------------------------
-- 6. Experienced (≥1yr) track — shown only when "has_experience" = yes
-- ---------------------------------------------------------------------------
-- Repurpose the old mentor-only years field for the experienced intake.
update public.config_questions
  set label_he = 'כמה שנות ניסיון אמיתי יש לך?', field_type = 'number', scope = 'junior',
      intake_track = 'experienced', required = true, sort_order = 70
  where key = 'years_experience';

insert into public.config_questions (key, label_he, field_type, required, sort_order, scope, intake_track, taxonomy_kind, options) values
  ('exp_role', 'באיזה תפקיד יש לך ניסיון?', 'multiselect', true, 71, 'junior', 'experienced', null,
    '[{"value":"dev","label":"מפתחת"},{"value":"qa","label":"בודקת / QA"},{"value":"analyst","label":"מאפיינת / אנליסטית"},{"value":"automation","label":"אוטומציה"},{"value":"devops","label":"DevOps"},{"value":"support","label":"תמיכה / יישום"},{"value":"other","label":"אחר"}]'::jsonb),
  ('exp_tech', 'באילו טכנולוגיות יש לך ניסיון אמיתי מעבודה?', 'multiselect', true, 72, 'junior', 'experienced', 'tech', '[]'::jsonb),
  ('exp_languages', 'באילו שפות יש לך ניסיון אמיתי?', 'multiselect', false, 73, 'junior', 'experienced', 'tech', '[]'::jsonb),
  ('currently_working', 'האם את עובדת כרגע?', 'bool', false, 74, 'junior', 'experienced', null, '[]'::jsonb),
  ('current_workplace', 'מקום עבודה נוכחי / אחרון', 'text', false, 75, 'junior', 'experienced', null, '[]'::jsonb),
  ('work_description', 'פרטי מה בדיוק עשית בעבודה', 'text', false, 76, 'junior', 'experienced', null, '[]'::jsonb),
  ('specific_job', 'רוצה לגשת למשרה ספציפית שפרסמנו? אם כן — איזו?', 'text', false, 77, 'junior', 'experienced', null, '[]'::jsonb)
on conflict (key) do nothing;
