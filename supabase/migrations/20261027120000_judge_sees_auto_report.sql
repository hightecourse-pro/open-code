-- 27/10 - "תפתח לרות אפין את הבחינה שלך": the owner may open the automated review
-- to a judge she picks. Her desk then shows "הבחינה שלי" and "הבחינה של ה-AI" as
-- two tabs with a comparison table per project (the owner: "לכל מתמודדת אפשר
-- יהיה לראות את הבחינה שלה + הבחינה של ה-AI ב-2 טאבים פנימיים + טבלת השוואה").
-- Off by default - a judge never sees the review unless the owner opened it to her.
alter table public.hackathon_judges
  add column if not exists sees_auto_report boolean not null default false;
