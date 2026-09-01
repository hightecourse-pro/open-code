-- ============================================================================
-- Jobs visible to the WHOLE community (the owner, 1/9: "האם המשרה תופיע גם
-- למי שייכנס מחר פעם ראשונה?"). Until now a targeted publish was visible to
-- its targets alone — future joiners never saw it. open_to_all keeps the
-- targeted emails/section AND opens the board card to everyone, including
-- members who sign up later.
-- ============================================================================

alter table public.jobs
  add column if not exists open_to_all boolean not null default false;

drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select using (
    (select public.is_member())
    and (is_visible or (select public.is_admin()))
    and (
      (select public.is_admin())
      or open_to_all
      or not exists (select 1 from public.job_targets t where t.job_id = jobs.id)
      or exists (
        select 1 from public.job_targets t
        where t.job_id = jobs.id and t.profile_id = (select auth.uid())
      )
    )
  );
