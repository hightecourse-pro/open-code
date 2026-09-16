-- One-statement link pass for email-keyed coordinator reviews (16/9): the
-- app-side loop (rpc per email, 60-row window) could never reach the whole
-- imported backlog. This runs the entire pass in the database.
create or replace function public.link_coordinator_reviews()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  -- A live linked row by the same contact wins — the imported shell folds away.
  delete from coordinator_reviews r
  using auth.users u, coordinator_reviews live
  where r.profile_id is null
    and r.graduate_email is not null
    and lower(u.email) = lower(r.graduate_email)
    and live.contact_id = r.contact_id
    and live.profile_id = u.id;

  update coordinator_reviews r
  set profile_id = u.id
  from auth.users u
  where r.profile_id is null
    and r.graduate_email is not null
    and lower(u.email) = lower(r.graduate_email);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.link_coordinator_reviews() from public;
revoke all on function public.link_coordinator_reviews() from anon;
revoke all on function public.link_coordinator_reviews() from authenticated;
