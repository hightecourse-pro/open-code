-- ============================================================================
-- קוד פתוח — RLS policies evaluated once per statement, not once per row.
--
-- is_member() / is_admin() / has_active_sub() are SECURITY DEFINER functions
-- the planner cannot inline, and 67 policies called them bare — so every
-- row of every protected query re-ran an EXISTS against profiles. Harmless at
-- 300 rows; the dominant DB cost on the way to 1,000 members. Wrapping a call
-- as (select fn()) hoists it to an InitPlan — once per statement — exactly the
-- trick these policies already use for auth.uid(). in_conversation(id) is
-- row-dependent by nature, so it becomes an inline EXISTS the planner can hash.
--
-- GENERATED from the live pg_policies definitions (no policy retyped by hand).
-- ALTER POLICY keeps each policy's command and roles; safe to re-run.
-- ============================================================================

alter policy "app_settings_admin_write" on public.app_settings
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "applications_own_select" on public.applications
  using ( ((applicant_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "applications_own_update" on public.applications
  using ( ((applicant_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) )
  with check ( ((applicant_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "applications_own_write" on public.applications
  with check ( ((applicant_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.is_member() )) );

alter policy "articles_admin_write" on public.articles
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "articles_select" on public.articles
  using ( (( SELECT public.is_member() ) OR ( SELECT public.is_admin() )) );

alter policy "comments_delete_own" on public.comments
  using ( ((author_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "comments_insert_own" on public.comments
  with check ( ((author_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.has_active_sub() )) );

alter policy "comments_modify_own" on public.comments
  using ( ((author_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) )
  with check ( ((author_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "comments_select" on public.comments
  using ( ( SELECT public.is_member() ) );

alter policy "config_questions_admin_write" on public.config_questions
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "config_taxonomies_admin_write" on public.config_taxonomies
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "content_links_admin_write" on public.content_links
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "content_links_select" on public.content_links
  using ( (( SELECT public.has_active_sub() ) OR (( SELECT public.is_member() ) AND (owner_type = 'session'::content_owner) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = content_links.owner_id) AND s.open_to_all))))) );

alter policy "content_shares_admin_write" on public.content_shares
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "content_shares_select" on public.content_shares
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "content_views_select" on public.content_views
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "conversations_insert" on public.conversations
  with check ( (((a_id = ( SELECT auth.uid() AS uid)) OR (b_id = ( SELECT auth.uid() AS uid))) AND ( SELECT public.has_active_sub() )) );

alter policy "courses_admin_write" on public.courses
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "courses_select" on public.courses
  using ( (( SELECT public.is_member() ) AND (is_published OR ( SELECT public.is_admin() ))) );

alter policy "cv_documents_owner" on public.cv_documents
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) )
  with check ( (profile_id = ( SELECT auth.uid() AS uid)) );

alter policy "cv_reviews_insert_own" on public.cv_reviews
  with check ( ((profile_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.has_active_sub() )) );

alter policy "cv_reviews_select" on public.cv_reviews
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR (reviewer_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "enrollments_select" on public.enrollments
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "enrollments_write_own" on public.enrollments
  using ( (profile_id = ( SELECT auth.uid() AS uid)) )
  with check ( ((profile_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.has_active_sub() )) );

alter policy "interview_sessions_own" on public.interview_sessions
  using ( (profile_id = ( SELECT auth.uid() AS uid)) )
  with check ( ((profile_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.has_active_sub() )) );

alter policy "job_candidates_admin" on public.job_candidates
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "job_offers_admin_write" on public.job_offers
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "job_offers_select" on public.job_offers
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "job_questions_admin" on public.job_questions
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "job_questions_member_select" on public.job_questions
  using ( ( SELECT public.is_member() ) );

alter policy "job_targets_admin" on public.job_targets
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "jobs_admin_write" on public.jobs
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "jobs_select" on public.jobs
  using ( (( SELECT public.is_member() ) AND (is_visible OR ( SELECT public.is_admin() )) AND (( SELECT public.is_admin() ) OR (NOT (EXISTS ( SELECT 1
   FROM job_targets t
  WHERE (t.job_id = jobs.id)))) OR (EXISTS ( SELECT 1
   FROM job_targets t
  WHERE ((t.job_id = jobs.id) AND (t.profile_id = ( SELECT auth.uid() AS uid))))))) );

alter policy "manual_hires_admin" on public.manual_hires
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "member_crm_admin_only" on public.member_crm
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "member_private_own" on public.member_private
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) )
  with check ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "mentor_profiles_select" on public.mentor_profiles
  using ( ( SELECT public.is_member() ) );

alter policy "mentor_profiles_write_own" on public.mentor_profiles
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) )
  with check ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "mentor_requests_admin_delete" on public.mentor_requests
  using ( ( SELECT public.is_admin() ) );

alter policy "mentor_requests_admin_update" on public.mentor_requests
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "mentor_requests_own" on public.mentor_requests
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "mentorships_admin_write" on public.mentorships
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "mentorships_select" on public.mentorships
  using ( ((mentor_id = ( SELECT auth.uid() AS uid)) OR (mentee_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "messages_insert" on public.messages
  with check ( ((sender_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND ( SELECT auth.uid() ) IN (c.a_id, c.b_id) )) AND ( SELECT public.has_active_sub() )) );

alter policy "messages_select" on public.messages
  using ( (EXISTS ( SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND ( SELECT auth.uid() ) IN (c.a_id, c.b_id) )) );

alter policy "payments_select_own" on public.payments
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "portal_clients_admin" on public.portal_clients
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "portal_favorites_admin" on public.portal_favorites
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "posts_delete_own" on public.posts
  using ( ((author_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "posts_insert_own" on public.posts
  with check ( ((author_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.has_active_sub() )) );

alter policy "posts_select" on public.posts
  using ( (( SELECT public.is_member() ) AND ((status = 'visible'::post_status) OR (author_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() ))) );

alter policy "profile_answers_select" on public.profile_answers
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "profiles_admin_all" on public.profiles
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "profiles_select" on public.profiles
  using ( ((id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_member() )) );

alter policy "reactions_select" on public.reactions
  using ( ( SELECT public.is_member() ) );

alter policy "reactions_write_own" on public.reactions
  using ( (profile_id = ( SELECT auth.uid() AS uid)) )
  with check ( ((profile_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.has_active_sub() )) );

alter policy "recordings_admin_write" on public.recordings
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "recordings_select" on public.recordings
  using ( ( SELECT public.has_active_sub() ) );

alter policy "reports_admin_read" on public.reports
  using ( ( SELECT public.is_admin() ) );

alter policy "reports_admin_update" on public.reports
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "reports_insert_own" on public.reports
  with check ( ((reporter_id = ( SELECT auth.uid() AS uid)) AND ( SELECT public.is_member() )) );

alter policy "sessions_admin_write" on public.sessions
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "sessions_select" on public.sessions
  using ( (( SELECT public.has_active_sub() ) AND (is_published OR ( SELECT public.is_admin() ))) );

alter policy "subscriptions_select_own" on public.subscriptions
  using ( ((profile_id = ( SELECT auth.uid() AS uid)) OR ( SELECT public.is_admin() )) );

alter policy "system_ai_key_usage_admin" on public.system_ai_key_usage
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );

alter policy "system_ai_keys_admin" on public.system_ai_keys
  using ( ( SELECT public.is_admin() ) )
  with check ( ( SELECT public.is_admin() ) );
