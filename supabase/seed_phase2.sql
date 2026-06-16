-- ============================================================================
-- Open Code — Phase 2 demo seed (jobs, courses, recordings, sessions)
-- Idempotent-ish: clears demo rows by a marker comment then re-inserts.
-- Safe to run after the Phase 2 migration.
-- ============================================================================

-- ---- jobs ----
insert into public.jobs (company, title, source, location, region, employment_type, description, tech_tags, logo_variant, status) values
  ('Wix', 'Junior Frontend Developer', 'ours', 'תל אביב', 'center', 'full',
   'הצטרפי לצוות פרונטאנד צעיר ותומך. נשמח לג''וניוריות עם בסיס ב-React ורצון ללמוד.',
   '{react,javascript,css}', 1, 'open'),
  ('monday.com', 'Junior Fullstack', 'ours', 'תל אביב', 'center', 'full',
   'תפקיד פולסטאק לג''וניורית — עבודה עם Node.js ו-React לצד מנטורינג צמוד.',
   '{nodejs,react,typescript}', 2, 'open'),
  ('Papaya Global', 'QA Engineer (Junior)', 'open', 'הרצליה', 'sharon', 'full',
   'בדיקות אוטומציה ומנואל למוצר גלובלי. אין צורך בניסיון קודם — נלמד אותך.',
   '{python,sql}', 4, 'open'),
  ('Fiverr', 'Student Backend Developer', 'open', 'מרחוק', 'remote', 'student',
   'משרת סטודנטית בבאקאנד, גמישה לשעות לימודים.',
   '{nodejs,sql}', 4, 'open'),
  ('Riskified', 'Frontend Developer', 'ours', 'תל אביב', 'center', 'full',
   'צוות פרונטאנד שאוהב לחנוך ג''וניוריות. סטאק מודרני, קוד נקי.',
   '{react,typescript,css}', 2, 'open'),
  ('Lemonade', 'Junior Data Analyst', 'open', 'תל אביב', 'center', 'part',
   'ניתוח נתונים ותמיכה בצוות הדאטה. מתאים לבוגרות בוטקאמפ דאטה.',
   '{python,sql}', 1, 'open');

-- ---- courses ----
insert into public.courses (title, category, tech_tags, lessons_count, duration_hours, instructor, cover_variant, is_published) values
  ('יסודות JavaScript', 'בסיס', '{javascript}', 12, 8, 'דנה לוי', 1, true),
  ('React מאפס למתקדמות', 'פרונטאנד', '{react,javascript}', 18, 14, 'נועה כהן', 2, true),
  ('Node.js ו-APIs', 'באקאנד', '{nodejs,sql}', 14, 10, 'שירה אבני', 3, true),
  ('TypeScript בעבודה', 'שפות', '{typescript}', 10, 6, 'מאיה גל', 6, true),
  ('SQL ומסדי נתונים', 'דאטה', '{sql}', 9, 5, 'רותם בר', 4, true),
  ('הכנה לראיונות טכניים', 'קריירה', '{javascript,react}', 8, 4, 'יעל שמש', 5, true);

-- ---- recordings ----
insert into public.recordings (title, category, duration_sec, is_free, cover_variant) values
  ('בניית RAG עם LangChain', 'AI', 3600, false, 2),
  ('מבוא ל-Git ו-GitHub', 'כלים', 2700, true, 1),
  ('איך עוברים ראיון HR', 'קריירה', 1800, true, 5),
  ('CSS מודרני — Grid ו-Flexbox', 'פרונטאנד', 3000, false, 6),
  ('עקרונות עיצוב API', 'באקאנד', 3300, false, 3),
  ('דיבוג כמו מקצוענית', 'כלים', 2400, false, 4);

-- ---- sessions (upcoming + past) ----
insert into public.sessions (title, topic, scheduled_at, status, is_published) values
  ('סשן שבועי: בניית RAG עם LangChain', 'AI', now() + interval '2 days', 'scheduled', true),
  ('Office Hours עם מנטוריות', 'קריירה', now() + interval '6 days', 'scheduled', true),
  ('סדנת ראיונות מקצועיים', 'קריירה', now() + interval '13 days', 'scheduled', true),
  ('מבוא ל-Docker', 'DevOps', now() - interval '5 days', 'done', true);
