-- One default CV per member — enforced by the database itself, not only by
-- the application code (the owner's concern, 2026-08-28: "יכול להיות כמה
-- קורות חיים עם תווית ברירת מחדל"). A partial unique index makes a second
-- default physically impossible, whatever the code does.
create unique index if not exists cv_documents_one_default_idx
  on public.cv_documents (profile_id)
  where is_default;
