-- ============================================================================
-- Open Code — full member intake profile (from the original community form)
-- Seeds the dynamic profile questions so every required field lives in the
-- profile. Admin can hide/relabel any of these from Admin → Configuration.
-- Idempotent: re-running skips existing keys.
-- ============================================================================

insert into public.config_questions (key, label_he, field_type, required, sort_order, scope, options) values
  -- ---- identity & contact (everyone) ----
  ('id_number',       'תעודת זהות', 'text', false, 11, 'all', '[]'::jsonb),
  ('phone',           'טלפון נייד', 'text', false, 12, 'all', '[]'::jsonb),
  ('city',            'עיר מגורים', 'text', false, 13, 'all', '[]'::jsonb),
  ('marital_status',  'מצב משפחתי', 'select', false, 14, 'all',
    '[{"value":"single","label":"רווקה"},{"value":"married","label":"נשואה"},{"value":"divorced","label":"גרושה"},{"value":"widowed","label":"אלמנה"},{"value":"other","label":"אחר"}]'::jsonb),
  ('prev_surname',    'שם משפחה קודם (אם רלוונטי)', 'text', false, 15, 'all', '[]'::jsonb),

  -- ---- education ----
  ('study_place',     'מקום לימודים', 'text', false, 20, 'junior', '[]'::jsonb),
  ('track',           'מגמה', 'select', false, 21, 'junior',
    '[{"value":"software","label":"הנדסת תוכנה"},{"value":"cs","label":"מדעי המחשב"},{"value":"practical_se","label":"הנדסאית תוכנה"},{"value":"electronics","label":"חשמל ואלקטרוניקה"},{"value":"qa","label":"בדיקות תוכנה / QA"},{"value":"cyber","label":"סייבר"},{"value":"other","label":"אחר"}]'::jsonb),
  ('track_specialization', 'התמחות ספציפית למגמה (אם היתה התמחות מלאה)', 'text', false, 22, 'junior', '[]'::jsonb),
  ('coordinator_name','שם רכזת המגמה', 'text', false, 23, 'junior', '[]'::jsonb),
  ('coordinator_phone','טלפון רכזת המגמה', 'text', false, 24, 'junior', '[]'::jsonb),
  ('coordinator_email','מייל רכזת המגמה', 'text', false, 25, 'junior', '[]'::jsonb),
  ('certificate',     'תעודה', 'select', false, 26, 'junior',
    '[{"value":"practical_eng","label":"הנדסאית"},{"value":"vocational","label":"תעודת מקצוע"},{"value":"degree","label":"תואר"},{"value":"other","label":"אחר"}]'::jsonb),
  ('graduation_year', 'שנת סיום לימודים (בהנדסאית — סיום שנה ב'')', 'number', false, 27, 'junior', '[]'::jsonb),

  -- ---- skills & GenAI ----
  ('dev_tech',        'אילו טכנולוגיות פיתוח למדת/התנסית בפועל? (רק כאלה שבאמת התנסית בהן)', 'multiselect', false, 30, 'junior',
    '[{"value":"react","label":"React"},{"value":"nodejs","label":"Node.js"},{"value":"typescript","label":"TypeScript"},{"value":"javascript","label":"JavaScript"},{"value":"python","label":"Python"},{"value":"sql","label":"SQL"},{"value":"css","label":"CSS"},{"value":"java","label":"Java"},{"value":"csharp","label":"C#"},{"value":"go","label":"Go"}]'::jsonb),
  ('genai_known',     'טכנולוגיות GenAI שיש לך בהן ידע אמיתי', 'text', false, 31, 'junior', '[]'::jsonb),
  ('genai_practiced', 'טכנולוגיות GenAI שהתנסית בהן בפועל (יצרת פרויקט)', 'text', false, 32, 'junior', '[]'::jsonb),
  ('ai_project_links','קישורים לפרויקטי AI שעשית', 'text', false, 33, 'junior', '[]'::jsonb),
  ('ai_tools_used',   'באיזה כלי AI יצא לך להשתמש בפועל?', 'text', false, 34, 'junior', '[]'::jsonb),
  ('ai_gaps',         'איזה חומר ב-AI את מרגישה שחסר לך?', 'text', false, 35, 'junior', '[]'::jsonb),

  -- ---- real-world experience ----
  ('practicum_done',  'עשית פרקטיקום / פרויקט עם לקוח אמיתי?', 'bool', false, 40, 'junior', '[]'::jsonb),
  ('practicum_employer','אם כן — מי היה המעסיק?', 'text', false, 41, 'junior', '[]'::jsonb),
  ('practicum_tech',  'אם כן — באילו טכנולוגיות?', 'text', false, 42, 'junior', '[]'::jsonb),

  -- ---- placement preferences ----
  ('remote_commute',  'משרה היברידית רחוקה ממגוריי — מתאים לי להתאמץ להגיע?', 'bool', false, 50, 'junior', '[]'::jsonb),
  ('practicum_placement', 'השמה דרך פרקטיקום (3 חודשים ללא שכר ואז קליטה) — להציע לי?', 'bool', false, 51, 'junior', '[]'::jsonb),
  ('paid_placement',  'השמה בתשלום (עלות כ-2500₪ אם אתקבל) — להציע לי?', 'bool', false, 52, 'junior', '[]'::jsonb),

  -- ---- free text ----
  ('notes_for_us',    'יש לך משהו לומר לנו?', 'text', false, 60, 'all', '[]'::jsonb)
on conflict (key) do nothing;
