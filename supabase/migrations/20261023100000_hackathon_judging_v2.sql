-- Judging v2 (the owner, 23/10): two independent judges per challenge who
-- never see each other, a mentor OR a team member appointed per challenge,
-- and the owner alone sees every score side by side.
--   hackathon_judges.challenge_keys  - which challenges she judges ({} = all)
--   hackathon_scores.comment         - a free note on the whole project
--   hackathon_submissions.drive_file_id - the video mirrored to Drive (personal
--                                      sharing for Netfree), filled by the team
alter table public.hackathon_judges
  add column if not exists challenge_keys text[] not null default '{}';

alter table public.hackathon_scores
  add column if not exists comment text;

alter table public.hackathon_submissions
  add column if not exists drive_file_id text;
