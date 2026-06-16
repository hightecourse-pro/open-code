-- ============================================================================
-- Open Code — seed data (taxonomies + starter profile questions)
-- Safe to re-run: uses ON CONFLICT DO NOTHING.
-- ============================================================================

-- ---------- regions ----------
insert into public.config_taxonomies (kind, value, label_he, sort_order) values
  ('region', 'center',     'מרכז', 1),
  ('region', 'north',      'צפון', 2),
  ('region', 'south',      'דרום', 3),
  ('region', 'jerusalem',  'ירושלים והסביבה', 4),
  ('region', 'sharon',     'השרון', 5),
  ('region', 'shfela',     'השפלה', 6),
  ('region', 'remote',     'עבודה מרחוק', 7)
on conflict (kind, value) do nothing;

-- ---------- specializations ----------
insert into public.config_taxonomies (kind, value, label_he, sort_order) values
  ('specialization', 'frontend',  'פרונטאנד', 1),
  ('specialization', 'backend',   'באקאנד', 2),
  ('specialization', 'fullstack', 'פולסטאק', 3),
  ('specialization', 'qa',        'QA / בדיקות', 4),
  ('specialization', 'devops',    'DevOps', 5),
  ('specialization', 'data',      'דאטה / AI', 6),
  ('specialization', 'mobile',    'מובייל', 7)
on conflict (kind, value) do nothing;

-- ---------- technologies ----------
insert into public.config_taxonomies (kind, value, label_he, sort_order) values
  ('tech', 'react',      'React', 1),
  ('tech', 'nodejs',     'Node.js', 2),
  ('tech', 'typescript', 'TypeScript', 3),
  ('tech', 'javascript', 'JavaScript', 4),
  ('tech', 'python',     'Python', 5),
  ('tech', 'sql',        'SQL', 6),
  ('tech', 'css',        'CSS', 7),
  ('tech', 'java',       'Java', 8),
  ('tech', 'csharp',     'C#', 9),
  ('tech', 'go',         'Go', 10)
on conflict (kind, value) do nothing;

-- ---------- project categories (for forum / jobs tagging) ----------
insert into public.config_taxonomies (kind, value, label_he, sort_order) values
  ('project_category', 'web',     'אתרים ואפליקציות web', 1),
  ('project_category', 'mobile',  'אפליקציות מובייל', 2),
  ('project_category', 'data',    'דאטה ובינה מלאכותית', 3),
  ('project_category', 'infra',   'תשתיות ו-DevOps', 4)
on conflict (kind, value) do nothing;

-- ---------- starter profile questions ----------
insert into public.config_questions (key, label_he, field_type, required, sort_order, scope, options) values
  ('specialization', 'מה התחום שלך?', 'select', true, 1, 'all',
   '[{"value":"frontend","label":"פרונטאנד"},{"value":"backend","label":"באקאנד"},{"value":"fullstack","label":"פולסטאק"},{"value":"qa","label":"QA / בדיקות"},{"value":"devops","label":"DevOps"},{"value":"data","label":"דאטה / AI"},{"value":"mobile","label":"מובייל"}]'::jsonb),
  ('region', 'אזור מגורים', 'select', true, 2, 'all',
   '[{"value":"center","label":"מרכז"},{"value":"north","label":"צפון"},{"value":"south","label":"דרום"},{"value":"jerusalem","label":"ירושלים והסביבה"},{"value":"sharon","label":"השרון"},{"value":"shfela","label":"השפלה"},{"value":"remote","label":"עבודה מרחוק"}]'::jsonb),
  ('tech_stack', 'הטכנולוגיות שלך', 'multiselect', false, 3, 'all',
   '[{"value":"react","label":"React"},{"value":"nodejs","label":"Node.js"},{"value":"typescript","label":"TypeScript"},{"value":"python","label":"Python"},{"value":"sql","label":"SQL"},{"value":"css","label":"CSS"},{"value":"java","label":"Java"}]'::jsonb),
  ('bio', 'קצת עליך', 'text', false, 4, 'all', '[]'::jsonb),
  ('github', 'קישור ל-GitHub', 'text', false, 5, 'all', '[]'::jsonb),
  ('years_experience', 'שנות ניסיון', 'number', false, 6, 'mentor', '[]'::jsonb)
on conflict (key) do nothing;
