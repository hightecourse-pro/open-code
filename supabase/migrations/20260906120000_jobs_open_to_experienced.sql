-- ============================================================================
-- Jobs visible to every EXPERIENCED member — future joiners included (the
-- owner, 6/9: "בעלות ניסיון כולל כאלה שיצטרפו אחר כך"). Sits between a frozen
-- target list and open_to_all: the board card shows to any member whose
-- profile carries is_experienced, whenever she joins. Emails still go only to
-- the audience picked at publish.
-- ============================================================================

alter table public.jobs
  add column if not exists open_to_experienced boolean not null default false;

drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select using (
    (select public.is_member())
    and (is_visible or (select public.is_admin()))
    and (
      (select public.is_admin())
      or open_to_all
      or (
        open_to_experienced
        and exists (
          select 1 from public.profiles pp
          where pp.id = (select auth.uid()) and pp.is_experienced
        )
      )
      or not exists (select 1 from public.job_targets t where t.job_id = jobs.id)
      or exists (
        select 1 from public.job_targets t
        where t.job_id = jobs.id and t.profile_id = (select auth.uid())
      )
    )
  );
