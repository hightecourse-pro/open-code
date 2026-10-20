-- Hackathon: the original feature (the owner, 20/10: "חשוב להוסיף בהגשה דגש על
-- פיצ'ר מקורי ולהכניס לניקוד"). A ninth part in the submission - what the
-- team built that the organisation did not ask for and would want - and a
-- seventh criterion in the rubric, 10 points, taken from architecture
-- (15 -> 10) and presentation (10 -> 5). The total stays 100.
-- No score rows existed on either environment when this ran, so the tighter
-- checks need no clamping.
alter table public.hackathon_submissions
  add column if not exists original_feature text;

alter table public.hackathon_scores
  add column if not exists original smallint not null default 0 check (original between 0 and 10);

alter table public.hackathon_scores drop constraint if exists hackathon_scores_architecture_check;
alter table public.hackathon_scores
  add constraint hackathon_scores_architecture_check check (architecture between 0 and 10);

alter table public.hackathon_scores drop constraint if exists hackathon_scores_presentation_check;
alter table public.hackathon_scores
  add constraint hackathon_scores_presentation_check check (presentation between 0 and 5);
