-- גמר בשידור חי, round 5 (the owner, 26/10): the hall screen is a ballot that
-- appears once after the three presentations and walks through the audience
-- criteria one by one. Each criterion gets a countdown; when it runs out the
-- next one opens by itself (0 = the organiser advances by hand).
alter table public.hackathon_live_settings add column vote_seconds int not null default 45 check (vote_seconds between 0 and 600);
