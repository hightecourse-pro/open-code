-- The owner (16/10): in the architecture section, "איזה בעיות משמעותיות נתקלת
-- בהן ואיך פתרת אותן". The long texts become rich HTML (sanitized on save).
alter table public.hackathon_submissions add column if not exists challenges_solved text;
