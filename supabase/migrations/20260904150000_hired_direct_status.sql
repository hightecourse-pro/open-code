-- "גויס ללא פרסום" (the owner, 3/9): a placement that happened without the
-- job ever going on the board — distinct from a published job's "hired".
alter table public.jobs drop constraint if exists jobs_pipeline_status_check;
alter table public.jobs add constraint jobs_pipeline_status_check
  check (pipeline_status in ('draft', 'published', 'candidates_sent', 'interviews', 'hired', 'hired_direct', 'closed_no_hire'));

-- The imported generic jobs are exactly that.
update public.jobs set pipeline_status = 'hired_direct'
  where title like 'משרה כללית — %' and pipeline_status = 'hired';
