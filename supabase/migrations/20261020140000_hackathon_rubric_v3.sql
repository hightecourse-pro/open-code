-- Hackathon rubric v3 (the owner's published text, 20/10 evening): six
-- criteria, no "הצגה" (the video is a submission part, not a criterion), and
-- the original feature takes its 5 points - 15. The presentation column stays
-- (unused, default 0). Still no score rows on either environment.
alter table public.hackathon_scores drop constraint if exists hackathon_scores_original_check;
alter table public.hackathon_scores
  add constraint hackathon_scores_original_check check (original between 0 and 15);
