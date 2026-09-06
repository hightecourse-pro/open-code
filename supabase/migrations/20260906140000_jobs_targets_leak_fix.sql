-- ============================================================================
-- LEAK FIX (found 6/9): job_targets' own-rows-only RLS made the jobs policy's
-- "NOT EXISTS targets → public" branch true for every member NOT on the list
-- (she cannot see the other rows), so every targeted job was board-visible to
-- the whole community since 1/9. The existence checks now run with definer
-- rights, blind to the caller's row visibility.
-- ============================================================================

create or replace function public.job_has_targets(jid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.job_targets t where t.job_id = jid) $$;

create or replace function public.job_targets_me(jid uuid)
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.job_targets t where t.job_id = jid and t.profile_id = auth.uid()) $$;

revoke all on function public.job_has_targets(uuid) from public;
revoke all on function public.job_targets_me(uuid) from public;
grant execute on function public.job_has_targets(uuid) to authenticated;
grant execute on function public.job_targets_me(uuid) to authenticated;

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
      or not public.job_has_targets(jobs.id)
      or public.job_targets_me(jobs.id)
    )
  );
