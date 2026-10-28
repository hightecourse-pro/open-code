-- גמר בשידור חי, round 2 (the owner, 26/10): the audience does not cast one
-- overall vote - it picks the best project per AUDIENCE criterion (user
-- experience, originality, the pitch, "I would use this"), one phone question
-- per criterion; the judges score the professional criteria. Every criterion
-- carries its weight and its owner, so the final score is one weighted sum:
-- judges 70, audience 30 (the owner: to keep friends in the hall from tipping
-- the result). A question therefore knows which criterion it serves, and the
-- old single question-per-challenge link and the separate judges' weight go.
alter table public.hackathon_live_questions add column criterion_key text;
create index hackathon_live_questions_challenge_idx on public.hackathon_live_questions (challenge_key, criterion_key);

alter table public.hackathon_live_challenges drop constraint hackathon_live_challenges_question_fk;
alter table public.hackathon_live_challenges drop column question_id;

alter table public.hackathon_live_settings drop column weights_judges;
alter table public.hackathon_live_settings alter column criteria set default '[
  {"key":"works","label":"עובד מקצה לקצה","weight":25,"owner":"judges","hint":"התסריט המלא רץ, בלי נפילות"},
  {"key":"correctness","label":"נכונות ואמינות","weight":20,"owner":"judges","hint":"עונה שלא יודע כשאין מידע, ולא ממציא"},
  {"key":"problem","label":"פתרון לבעיה האמיתית","weight":15,"owner":"judges","hint":"המוצר עונה למה שהארגון ביקש"},
  {"key":"architecture","label":"ארכיטקטורה של פיתוח AI","weight":10,"owner":"judges","hint":"איך המערכת בנויה, והאם הצוות יודע להסביר"},
  {"key":"ux","label":"חוויית משתמש","weight":7.5,"owner":"audience","hint":"הכי נוח, נעים ומעוצב"},
  {"key":"original","label":"מקוריות ויצירתיות","weight":7.5,"owner":"audience","hint":"הפיצ׳ר שהפתיע"},
  {"key":"pitch","label":"ההצגה על הבמה","weight":7.5,"owner":"audience","hint":"מי הציגה והסבירה הכי טוב"},
  {"key":"use","label":"הייתי בוחרת להשתמש בזה","weight":7.5,"owner":"audience","hint":"בחירת הקהל"}
]'::jsonb;
update public.hackathon_live_settings set criteria = '[
  {"key":"works","label":"עובד מקצה לקצה","weight":25,"owner":"judges","hint":"התסריט המלא רץ, בלי נפילות"},
  {"key":"correctness","label":"נכונות ואמינות","weight":20,"owner":"judges","hint":"עונה שלא יודע כשאין מידע, ולא ממציא"},
  {"key":"problem","label":"פתרון לבעיה האמיתית","weight":15,"owner":"judges","hint":"המוצר עונה למה שהארגון ביקש"},
  {"key":"architecture","label":"ארכיטקטורה של פיתוח AI","weight":10,"owner":"judges","hint":"איך המערכת בנויה, והאם הצוות יודע להסביר"},
  {"key":"ux","label":"חוויית משתמש","weight":7.5,"owner":"audience","hint":"הכי נוח, נעים ומעוצב"},
  {"key":"original","label":"מקוריות ויצירתיות","weight":7.5,"owner":"audience","hint":"הפיצ׳ר שהפתיע"},
  {"key":"pitch","label":"ההצגה על הבמה","weight":7.5,"owner":"audience","hint":"מי הציגה והסבירה הכי טוב"},
  {"key":"use","label":"הייתי בוחרת להשתמש בזה","weight":7.5,"owner":"audience","hint":"בחירת הקהל"}
]'::jsonb where id = 1;
