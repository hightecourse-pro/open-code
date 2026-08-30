-- course_feedback shipped with an owner-only policy — correct for members,
-- but it also blinded the ADMIN analytics: feedback without an enrollments
-- twin (gifted courses, admins) never reached "משובים מהחברות". Admins read
-- everything; members still see only their own rows.
create policy course_feedback_admin_read on public.course_feedback
  for select to authenticated
  using (public.is_admin());
