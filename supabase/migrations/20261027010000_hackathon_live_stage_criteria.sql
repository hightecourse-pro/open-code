-- The finals-evening criteria in the owner's words (27/10): what reached the stage already works end to end
-- and is reliable (the judging desk filtered for that), so the stage is judged on four things only -
-- מקוריות, מוכנות לשימוש, הצגה על הבמה, חווית משתמש - by the judges (70, 17.5 each) and by the audience (30, 7.5 each).
-- Same four labels, two owners; the keys differ so the judges' page and the phone ballot each get their own four.
alter table public.hackathon_live_settings alter column criteria set default '[
  {"key":"original_j","label":"מקוריות","weight":17.5,"owner":"judges","hint":"מה שמעבר לאתגר"},
  {"key":"ready_j","label":"מוכנות לשימוש","weight":17.5,"owner":"judges","hint":"אפשר להכניס לעבודה מחר"},
  {"key":"pitch_j","label":"הצגה על הבמה","weight":17.5,"owner":"judges","hint":"ברור, משכנע, בזמן"},
  {"key":"ux_j","label":"חווית משתמש","weight":17.5,"owner":"judges","hint":"נוח, נעים, מעוצב"},
  {"key":"original","label":"מקוריות","weight":7.5,"owner":"audience","hint":"מה שמעבר לאתגר"},
  {"key":"ready","label":"מוכנות לשימוש","weight":7.5,"owner":"audience","hint":"אפשר להכניס לעבודה מחר"},
  {"key":"pitch","label":"הצגה על הבמה","weight":7.5,"owner":"audience","hint":"ברור, משכנע, בזמן"},
  {"key":"ux","label":"חווית משתמש","weight":7.5,"owner":"audience","hint":"נוח, נעים, מעוצב"}
]'::jsonb;

-- the row keeps whatever the organiser already edited by hand; the untouched default moves to the new one
update public.hackathon_live_settings
set criteria = '[
  {"key":"original_j","label":"מקוריות","weight":17.5,"owner":"judges","hint":"מה שמעבר לאתגר"},
  {"key":"ready_j","label":"מוכנות לשימוש","weight":17.5,"owner":"judges","hint":"אפשר להכניס לעבודה מחר"},
  {"key":"pitch_j","label":"הצגה על הבמה","weight":17.5,"owner":"judges","hint":"ברור, משכנע, בזמן"},
  {"key":"ux_j","label":"חווית משתמש","weight":17.5,"owner":"judges","hint":"נוח, נעים, מעוצב"},
  {"key":"original","label":"מקוריות","weight":7.5,"owner":"audience","hint":"מה שמעבר לאתגר"},
  {"key":"ready","label":"מוכנות לשימוש","weight":7.5,"owner":"audience","hint":"אפשר להכניס לעבודה מחר"},
  {"key":"pitch","label":"הצגה על הבמה","weight":7.5,"owner":"audience","hint":"ברור, משכנע, בזמן"},
  {"key":"ux","label":"חווית משתמש","weight":7.5,"owner":"audience","hint":"נוח, נעים, מעוצב"}
]'::jsonb
where id = 1 and (criteria->0->>'key') = 'works';
