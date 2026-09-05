-- חוות דעת מערכת על ניסיון ה-AI של מועמדת (the owner, 5/9): קטלוג סוג
-- הפיתוח, הקשר הניסיון, החברה, עומק ההבנה — וחוות דעת חופשית. נכתב על ידי
-- ניתוח קלוד של הפרופיל+קו"ח+תשובות ההגשה. אדמין בלבד.
create table if not exists public.application_assessments (
  application_id uuid primary key references public.applications (id) on delete cascade,
  ai_domain      text check (ai_domain in ('classic', 'ml', 'basic', 'none')),
  experience_context text check (experience_context in ('work', 'studies', 'none')),
  company        text,
  depth          text check (depth in ('solid', 'basic', 'fluff')),
  verdict        text,
  analyzed_at    timestamptz not null default now()
);

alter table public.application_assessments enable row level security;
drop policy if exists application_assessments_admin on public.application_assessments;
create policy application_assessments_admin on public.application_assessments
  for all using (public.is_admin()) with check (public.is_admin());
