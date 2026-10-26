-- גמר בשידור חי, round 3 (the owner, 26/10): one judges' page for everyone -
-- a judge types her name and picks her challenge at the entrance, so no
-- personal links. A short code, shown in the control panel and told to the
-- judges, keeps the audience from registering as judges.
alter table public.hackathon_live_settings add column judge_code text not null default '2026';
