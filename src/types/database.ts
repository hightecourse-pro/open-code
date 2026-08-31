// Hand-maintained to match supabase/migrations/*.sql.
// When the Supabase CLI is linked, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------- enums ----------
export type UserRole = "junior" | "mentor" | "admin";
export type MemberTier = "paid" | "free";
export type ProfileStatus = "pending" | "active" | "paused" | "rejected";
export type SubscriptionPlan = "monthly" | "annual";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type PaymentStatus = "succeeded" | "failed" | "refunded";
export type MentorAvailability = "available" | "busy" | "away";
export type FieldType = "text" | "select" | "multiselect" | "number" | "bool" | "tags";
export type QuestionScope = "junior" | "mentor" | "all";
export type TaxonomyKind = "tech" | "project_category" | "region" | "specialization" | "list";
export type PostKind = "feed" | "forum";
export type PostIntent = "consult" | "knowledge" | "success";
export type PostStatus = "visible" | "removed";
export type ReactionKind = "like" | "save";
export type ReportTarget = "post" | "comment";
export type ReportStatus = "open" | "reviewed" | "dismissed";
// Phase 2
export type JobSource = "ours" | "open";
export type JobStatus = "open" | "closed";
export type EmploymentType = "full" | "part" | "student" | "freelance";
export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "in_review"
  | "accepted"
  | "rejected"
  | "sent"
  | "interview"
  | "exam"
  | "hired"
  | "declined"
  | "waitlisted";
export type EnrollmentStatus = "active" | "completed" | "returned";
export type SessionStatus = "scheduled" | "live" | "done";
// Phase 3
export type CvSource = "ai" | "mentor";
export type InterviewAgent = "hr" | "tech" | "friendly";
export type InterviewDifficulty = "basic" | "standard" | "hard";
export type InterviewStatus = "live" | "done";
export type TurnRole = "agent" | "candidate";
// Phase 4
export type CvLanguage = "he" | "en" | "job";
export type ContentOwner = "course" | "session";
export type LinkKind = "video" | "materials";
export type ShareStatus = "pending" | "shared" | "revoked";
// Jobs CRM
export type JobKind = "immediate" | "practicum_placement" | "practicum_percent" | "practicum_free" | "other";
export type JobPipelineStatus = "draft" | "published" | "candidates_sent" | "interviews" | "hired" | "closed_no_hire";
/** How a required job question is answered — like Google Forms field types. */
export type QuestionAnswerType = "paragraph" | "number" | "select" | "multiselect";
export type ClientCrmStatus = "initial_call" | "materials_sent" | "job_active" | "hired";

type Timestamps = { created_at: string; updated_at: string };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          first_name: string | null;
          last_name: string | null;
          avatar_initials: string | null;
          region: string | null;
          specialization: string | null;
          bio: string | null;
          links: Json;
          role: UserRole;
          member_tier: MemberTier;
          status: ProfileStatus;
          is_experienced: boolean;
          /** Deprecated — CRM data moved to member_crm (admin-only). */
          is_vip: boolean;
          internal_notes: string | null;
          profile_completed: boolean;
          digest_frequency: string; // 'daily' | 'unread' | 'off'
          /** Opt-out from the employer portal listing. */
          portal_listed: boolean;
          /** Team test/preview account: fully active for its owner, invisible
              to other members and to the employer portal. */
          is_hidden: boolean;
          /** Stamped when a mentor application was declined — the registry
              in ניהול מנטוריות lists these. */
          mentor_declined_at: string | null;
          found_job: boolean;
          hired_via_us: boolean;
          hired_at: string | null;
          /** Mentors only: temporarily unavailable for new accompaniments. */
          mentor_available: boolean;
          /** Digest fairness stamp — the morning window serves oldest first. */
          digest_last_sent_at: string | null;
        } & Timestamps;
        Insert: {
          id: string;
          full_name?: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_initials?: string | null;
          region?: string | null;
          specialization?: string | null;
          bio?: string | null;
          links?: Json;
          role?: UserRole;
          member_tier?: MemberTier;
          status?: ProfileStatus;
          is_experienced?: boolean;
          is_vip?: boolean;
          internal_notes?: string | null;
          profile_completed?: boolean;
          digest_frequency?: string;
          portal_listed?: boolean;
          is_hidden?: boolean;
          mentor_declined_at?: string | null;
          found_job?: boolean;
          hired_via_us?: boolean;
          hired_at?: string | null;
          mentor_available?: boolean;
          digest_last_sent_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      mentor_requests: {
        Row: {
          id: string;
          profile_id: string;
          reason: string;
          note: string | null;
          status: string; // 'open' | 'handled'
          kind: "general" | "employment";
          assigned_mentor_id: string | null;
          /** Stamped when the MENTOR accepts — only then the member sees her. */
          mentor_accepted_at: string | null;
          created_at: string;
          handled_at: string | null;
          /** Why a handled request was reopened (incl. "המנטורית סירבה"). */
          reopen_reason: string | null;
          reopened_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          reason: string;
          note?: string | null;
          status?: string;
          kind?: "general" | "employment";
          assigned_mentor_id?: string | null;
          mentor_accepted_at?: string | null;
          created_at?: string;
          handled_at?: string | null;
          reopen_reason?: string | null;
          reopened_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["mentor_requests"]["Insert"]>;
        Relationships: [];
      };
      mentor_admin_log: {
        Row: {
          id: string;
          mentor_id: string;
          action: string;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mentor_id: string;
          action: string;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mentor_admin_log"]["Insert"]>;
        Relationships: [];
      };
      /** Employer-portal clients — companies, not community members. */
      portal_clients: {
        Row: {
          id: string;
          company_name: string;
          /** Null until the client reaches "job_active" and portal access is assigned. */
          username: string | null;
          /** Encrypted (reversible) password — admin can re-read it. */
          password_enc: string | null;
          password_hash: string | null;
          password_salt: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          crm_status: ClientCrmStatus;
          /** May this client use the portal's free candidate search? */
          can_search: boolean;
          crm_notes: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id?: string;
          company_name: string;
          username?: string | null;
          password_enc?: string | null;
          password_hash?: string | null;
          password_salt?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          crm_status?: ClientCrmStatus;
          can_search?: boolean;
          crm_notes?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          last_login_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["portal_clients"]["Insert"]>;
        Relationships: [];
      };
      /** Candidates an admin curated for a client's job (portal "My Jobs"). */
      job_candidates: {
        Row: {
          id: string;
          job_id: string;
          profile_id: string;
          /** Client asked to interview this candidate. */
          interview_marked: boolean;
          client_note: string | null;
          sent_at: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          profile_id: string;
          interview_marked?: boolean;
          client_note?: string | null;
          sent_at?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["job_candidates"]["Insert"]>;
        Relationships: [];
      };
      /** The audience a targeted job was published to (by criteria or manual pick). */
      job_targets: {
        Row: {
          job_id: string;
          profile_id: string;
          source: "criteria" | "manual";
          emailed_at: string | null;
          created_at: string;
        };
        Insert: {
          job_id: string;
          profile_id: string;
          source?: "criteria" | "manual";
          emailed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["job_targets"]["Insert"]>;
        Relationships: [];
      };
      /** Admin-defined application questions per job. */
      job_questions: {
        Row: {
          id: string;
          job_id: string;
          question: string;
          answer_type: QuestionAnswerType;
          options: Json | null;
          sort_order: number;
          required: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          question: string;
          answer_type?: QuestionAnswerType;
          options?: Json | null;
          sort_order?: number;
          required?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["job_questions"]["Insert"]>;
        Relationships: [];
      };
      /** Women placed via Open Code before ever joining — banner-only names. */
      manual_hires: {
        Row: {
          id: string;
          full_name: string;
          hired_at: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          hired_at?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["manual_hires"]["Insert"]>;
        Relationships: [];
      };
      /** Candidates a portal client marked as favorites. */
      portal_favorites: {
        Row: { client_id: string; profile_id: string; created_at: string };
        Insert: { client_id: string; profile_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["portal_favorites"]["Insert"]>;
        Relationships: [];
      };
      /** Shared Google API keys used by the portal's smart search. */
      system_ai_keys: {
        Row: {
          id: string;
          label: string | null;
          key_cipher: string;
          key_last4: string | null;
          status: string;
          last_error: string | null;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          label?: string | null;
          key_cipher: string;
          key_last4?: string | null;
          status?: string;
          last_error?: string | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["system_ai_keys"]["Insert"]>;
        Relationships: [];
      };
      system_ai_key_usage: {
        Row: { key_id: string; day: string; calls: number; errors: number };
        Insert: { key_id: string; day?: string; calls?: number; errors?: number };
        Update: Partial<Database["public"]["Tables"]["system_ai_key_usage"]["Insert"]>;
        Relationships: [];
      };
      /** Owner-only: the Google address we share Drive material with. */
      member_private: {
        Row: {
          profile_id: string;
          drive_email: string | null;
          drive_email_requested_at: string | null;
          /** Where she works — team-only; never readable by other members. */
          workplace: string | null;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          drive_email?: string | null;
          drive_email_requested_at?: string | null;
          workplace?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["member_private"]["Insert"]>;
        Relationships: [];
      };
      member_crm: {
        Row: {
          profile_id: string;
          is_vip: boolean;
          vip_reason: string | null;
          internal_notes: string | null;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          is_vip?: boolean;
          vip_reason?: string | null;
          internal_notes?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["member_crm"]["Insert"]>;
        Relationships: [];
      };
      mentor_profiles: {
        Row: {
          profile_id: string;
          years_experience: number | null;
          domains: string[];
          reviews_cv: boolean;
          reviews_interviews: boolean;
          leads_sessions: boolean;
          availability: MentorAvailability;
        } & Timestamps;
        Insert: {
          profile_id: string;
          years_experience?: number | null;
          domains?: string[];
          reviews_cv?: boolean;
          reviews_interviews?: boolean;
          leads_sessions?: boolean;
          availability?: MentorAvailability;
        };
        Update: Partial<Database["public"]["Tables"]["mentor_profiles"]["Insert"]>;
        Relationships: [];
      };
      mentorships: {
        Row: {
          id: string;
          mentor_id: string;
          mentee_id: string;
          status: string;
          started_at: string;
        };
        Insert: { id?: string; mentor_id: string; mentee_id: string; status?: string; started_at?: string };
        Update: Partial<Database["public"]["Tables"]["mentorships"]["Insert"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          provider: string;
          provider_sub_id: string | null;
          plan: SubscriptionPlan;
          status: SubscriptionStatus;
          min_term_months: number;
          current_period_end: string | null;
          started_at: string;
          canceled_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          profile_id: string;
          provider?: string;
          provider_sub_id?: string | null;
          plan?: SubscriptionPlan;
          status?: SubscriptionStatus;
          min_term_months?: number;
          current_period_end?: string | null;
          started_at?: string;
          canceled_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          subscription_id: string | null;
          profile_id: string;
          provider_payment_id: string | null;
          amount_agorot: number;
          currency: string;
          status: PaymentStatus;
          paid_at: string | null;
          raw: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id?: string | null;
          profile_id: string;
          provider_payment_id?: string | null;
          amount_agorot: number;
          currency?: string;
          status?: PaymentStatus;
          paid_at?: string | null;
          raw?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      config_questions: {
        Row: {
          id: string;
          key: string;
          label_he: string;
          field_type: FieldType;
          required: boolean;
          sort_order: number;
          active: boolean;
          scope: QuestionScope;
          options: Json;
          taxonomy_kind: TaxonomyKind | null;
          depends_on: string | null;
          intake_track: string; // 'both' | 'junior' | 'experienced'
          /** May an employer-portal client see the answer to this question? */
          employer_visible: boolean;
        } & Timestamps;
        Insert: {
          id?: string;
          key: string;
          label_he: string;
          field_type?: FieldType;
          required?: boolean;
          sort_order?: number;
          active?: boolean;
          scope?: QuestionScope;
          options?: Json;
          taxonomy_kind?: TaxonomyKind | null;
          depends_on?: string | null;
          intake_track?: string;
          employer_visible?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["config_questions"]["Insert"]>;
        Relationships: [];
      };
      config_taxonomies: {
        Row: {
          id: string;
          kind: TaxonomyKind;
          value: string;
          label_he: string;
          /** Group heading (e.g. "פרונטאנד") — techs render grouped by it. */
          group_he: string | null;
          sort_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: TaxonomyKind;
          value: string;
          label_he: string;
          group_he?: string | null;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["config_taxonomies"]["Insert"]>;
        Relationships: [];
      };
      profile_answers: {
        Row: {
          id: string;
          profile_id: string;
          question_id: string;
          value: Json | null;
        } & Timestamps;
        Insert: {
          id?: string;
          profile_id: string;
          question_id: string;
          value?: Json | null;
        };
        Update: Partial<Database["public"]["Tables"]["profile_answers"]["Insert"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          kind: PostKind;
          intent: PostIntent;
          body: string;
          tech_tags: string[];
          is_official: boolean;
          is_pinned: boolean;
          status: PostStatus;
          /** Set when the author fixed her words inside the edit window. */
          edited_at: string | null;
          /** Trigger-maintained counters — the list never recounts raw rows. */
          reply_count: number;
          like_count: number;
          last_reply_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          author_id: string;
          kind?: PostKind;
          intent?: PostIntent;
          body: string;
          tech_tags?: string[];
          is_official?: boolean;
          is_pinned?: boolean;
          edited_at?: string | null;
          status?: PostStatus;
        };
        Update: Partial<Database["public"]["Tables"]["posts"]["Insert"]>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          edited_at: string | null;
        } & Timestamps;
        Insert: { id?: string; post_id: string; author_id: string; body: string; edited_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["comments"]["Insert"]>;
        Relationships: [];
      };
      reactions: {
        Row: {
          id: string;
          post_id: string;
          profile_id: string;
          kind: ReactionKind;
          created_at: string;
        };
        Insert: { id?: string; post_id: string; profile_id: string; kind?: ReactionKind; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Insert"]>;
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: Json; updated_at: string };
        Insert: { key: string; value?: Json; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Insert"]>;
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          profile_id: string;
          context: "post" | "comment" | "message" | null;
          context_id: string | null;
          file_path: string;
          file_name: string;
          mime: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          context?: "post" | "comment" | "message" | null;
          context_id?: string | null;
          file_path: string;
          file_name: string;
          mime: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attachments"]["Insert"]>;
        Relationships: [];
      };
      external_payments: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          zeout: string | null;
          client_name: string | null;
          provider_payment_id: string;
          amount_agorot: number | null;
          plan: string;
          raw: Json | null;
          claimed_by: string | null;
          claimed_at: string | null;
          /** Arrived from an unrecognized caller — admin must confirm first. */
          needs_review: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          needs_review?: boolean;
          email?: string | null;
          phone?: string | null;
          zeout?: string | null;
          client_name?: string | null;
          provider_payment_id: string;
          amount_agorot?: number | null;
          plan?: string;
          raw?: Json | null;
          claimed_by?: string | null;
          claimed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["external_payments"]["Insert"]>;
        Relationships: [];
      };
      session_feedback: {
        Row: {
          session_id: string;
          profile_id: string;
          attended: boolean;
          content_rating: number | null;
          practical_rating: number | null;
          clarity_rating: number | null;
          speaker_rating: number | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          session_id: string;
          profile_id: string;
          attended: boolean;
          content_rating?: number | null;
          practical_rating?: number | null;
          clarity_rating?: number | null;
          speaker_rating?: number | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["session_feedback"]["Insert"]>;
        Relationships: [];
      };
      mentor_bonus_points: {
        Row: {
          id: string;
          mentor_id: string;
          points: number;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mentor_id: string;
          points: number;
          reason?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mentor_bonus_points"]["Insert"]>;
        Relationships: [];
      };
      member_requests: {
        Row: {
          id: string;
          profile_id: string;
          subject: string;
          body: string;
          status: "open" | "handled";
          handled_at: string | null;
          handled_by: string | null;
          handled_by_name: string | null;
          reply: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          subject: string;
          body: string;
          status?: "open" | "handled";
          handled_at?: string | null;
          handled_by?: string | null;
          handled_by_name?: string | null;
          reply?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["member_requests"]["Insert"]>;
        Relationships: [];
      };
      session_reminders: {
        Row: {
          session_id: string;
          stage: "morning" | "t30" | "start";
          sent_at: string;
          recipients: number;
        };
        Insert: {
          session_id: string;
          stage: "morning" | "t30" | "start";
          sent_at?: string;
          recipients?: number;
        };
        Update: Partial<Database["public"]["Tables"]["session_reminders"]["Insert"]>;
        Relationships: [];
      };
      /** Admin-only note on one application (member × job) — see the migration. */
      application_notes: {
        Row: {
          application_id: string;
          note: string | null;
          updated_at: string;
        };
        Insert: {
          application_id: string;
          note?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["application_notes"]["Insert"]>;
        Relationships: [];
      };
      /** Feedback with no enrollment dependency (admins, gifted courses). */
      course_feedback: {
        Row: {
          profile_id: string;
          course_id: string;
          rating: number | null;
          feedback: string | null;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          course_id: string;
          rating?: number | null;
          feedback?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_feedback"]["Insert"]>;
        Relationships: [];
      };
      /** Per-recipient reminder queue — drained in bounded batches by the tick. */
      session_reminder_queue: {
        Row: {
          session_id: string;
          stage: string;
          profile_id: string;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          session_id: string;
          stage: string;
          profile_id: string;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["session_reminder_queue"]["Insert"]>;
        Relationships: [];
      };
      admin_alerts: {
        Row: {
          id: string;
          kind: string;
          severity: "critical" | "warning" | "info";
          title: string;
          body: string | null;
          context: Json | null;
          dedupe_key: string | null;
          count: number;
          created_at: string;
          last_seen_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          kind: string;
          severity?: "critical" | "warning" | "info";
          title: string;
          body?: string | null;
          context?: Json | null;
          dedupe_key?: string | null;
          count?: number;
          created_at?: string;
          last_seen_at?: string;
          read_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["admin_alerts"]["Insert"]>;
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          title: string;
          excerpt: string | null;
          url: string | null;
          /** Rich in-app content (sanitizeArticleHtml) — the alternative to url. */
          body_html: string | null;
          category: string | null;
          author_name: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          excerpt?: string | null;
          url?: string | null;
          body_html?: string | null;
          category?: string | null;
          author_name?: string | null;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["articles"]["Insert"]>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          company: string;
          title: string;
          source: JobSource;
          location: string | null;
          region: string | null;
          employment_type: EmploymentType;
          description: string;
          tech_tags: string[];
          external_url: string | null;
          target_criteria: Json;
          logo_variant: number;
          is_visible: boolean;
          status: JobStatus;
          posted_by: string | null;
          /** The portal client this job belongs to, if any. */
          client_id: string | null;
          job_kind: JobKind;
          /** Employer share (1-100) for practicum_percent jobs. */
          practicum_percent: number | null;
          pipeline_status: JobPipelineStatus;
          role_category: string | null;
          description_html: string | null;
          published_at: string | null;
          /** Internal note for the team reviewing this job's applicants. */
          team_note: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          company: string;
          title: string;
          source?: JobSource;
          location?: string | null;
          region?: string | null;
          employment_type?: EmploymentType;
          description?: string;
          tech_tags?: string[];
          external_url?: string | null;
          target_criteria?: Json;
          client_id?: string | null;
          logo_variant?: number;
          is_visible?: boolean;
          status?: JobStatus;
          posted_by?: string | null;
          job_kind?: JobKind;
          practicum_percent?: number | null;
          pipeline_status?: JobPipelineStatus;
          role_category?: string | null;
          description_html?: string | null;
          published_at?: string | null;
          team_note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          job_id: string;
          applicant_id: string;
          status: ApplicationStatus;
          note: string | null;
          submitted_at: string;
          /** The CV she attached for this job — what the client downloads. */
          cv_document_id: string | null;
          /** {question_id: answer, fit: "..."} */
          answers: Json | null;
          admin_mark: "optional" | "not_fit" | "approved" | null;
          admin_mark_reason: string | null;
          sent_to_client_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          job_id: string;
          applicant_id: string;
          status?: ApplicationStatus;
          note?: string | null;
          submitted_at?: string;
          cv_document_id?: string | null;
          answers?: Json | null;
          admin_mark?: "optional" | "not_fit" | "approved" | null;
          admin_mark_reason?: string | null;
          sent_to_client_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>;
        Relationships: [];
      };
      saved_jobs: {
        Row: { job_id: string; profile_id: string; created_at: string };
        Insert: { job_id: string; profile_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["saved_jobs"]["Insert"]>;
        Relationships: [];
      };
      job_offers: {
        Row: { id: string; job_id: string; profile_id: string; sent_at: string };
        Insert: { id?: string; job_id: string; profile_id: string; sent_at?: string };
        Update: Partial<Database["public"]["Tables"]["job_offers"]["Insert"]>;
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          title: string;
          category: string | null;
          tech_tags: string[];
          lessons_count: number;
          duration_hours: number;
          instructor: string | null;
          drive_url: string | null;
          cover_variant: number;
          is_published: boolean;
          /** The Excel import key — one course per קוד קורס. */
          code: number | null;
        } & Timestamps;
        Insert: {
          id?: string;
          title: string;
          category?: string | null;
          tech_tags?: string[];
          lessons_count?: number;
          duration_hours?: number;
          instructor?: string | null;
          drive_url?: string | null;
          cover_variant?: number;
          is_published?: boolean;
          code?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>;
        Relationships: [];
      };
      enrollments: {
        Row: {
          id: string;
          profile_id: string;
          course_id: string;
          status: EnrollmentStatus;
          progress_pct: number;
          shared_to_email: string | null;
          last_switch_month: string | null;
          started_at: string;
          switched_at: string | null;
          studied: boolean;
          rating: number | null;
          feedback: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          profile_id: string;
          course_id: string;
          status?: EnrollmentStatus;
          progress_pct?: number;
          shared_to_email?: string | null;
          last_switch_month?: string | null;
          started_at?: string;
          switched_at?: string | null;
          studied?: boolean;
          rating?: number | null;
          feedback?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["enrollments"]["Insert"]>;
        Relationships: [];
      };
      recordings: {
        Row: {
          id: string;
          title: string;
          category: string | null;
          duration_sec: number;
          video_url: string | null;
          is_free: boolean;
          session_id: string | null;
          cover_variant: number;
          published_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category?: string | null;
          duration_sec?: number;
          video_url?: string | null;
          is_free?: boolean;
          session_id?: string | null;
          cover_variant?: number;
          published_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recordings"]["Insert"]>;
        Relationships: [];
      };
      recording_views: {
        Row: { recording_id: string; profile_id: string; watched_at: string };
        Insert: { recording_id: string; profile_id: string; watched_at?: string };
        Update: Partial<Database["public"]["Tables"]["recording_views"]["Insert"]>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          title: string;
          topic: string | null;
          leader_id: string | null;
          scheduled_at: string;
          zoom_url: string | null;
          status: SessionStatus;
          is_published: boolean;
          recording_id: string | null;
          canceled_at: string | null;
          /** Recording open to the whole community, free tier included. */
          open_to_all: boolean;
          /** Downloadable handouts — plain URLs the admin pastes. */
          syllabus_url: string | null;
          pre_topics: string | null;
          materials_url: string | null;
          /** Planned length, minutes — shown in admin and on the events screen. */
          duration_minutes: number | null;
        } & Timestamps;
        Insert: {
          id?: string;
          title: string;
          topic?: string | null;
          leader_id?: string | null;
          scheduled_at: string;
          zoom_url?: string | null;
          status?: SessionStatus;
          is_published?: boolean;
          recording_id?: string | null;
          open_to_all?: boolean;
          canceled_at?: string | null;
          syllabus_url?: string | null;
          pre_topics?: string | null;
          materials_url?: string | null;
          duration_minutes?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
        Relationships: [];
      };
      external_applications: {
        Row: {
          id: string;
          job_id: string;
          email: string;
          note: string | null;
          created_by: string | null;
          created_at: string;
          claimed_profile_id: string | null;
          claimed_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          email: string;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
          claimed_profile_id?: string | null;
          claimed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["external_applications"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: { id: string; a_id: string; b_id: string; last_message_at: string; created_at: string };
        Insert: { id?: string; a_id: string; b_id: string; last_message_at?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          read_at: string | null;
          created_at: string;
          /** One emoji per participant, keyed by profile id. */
          reactions: Json;
          /** The quoted message (chat reply), when there is one. */
          reply_to_id: string | null;
          /** Set once the grace-period email cron handled this message. */
          email_notified_at: string | null;
          /** Set when the sender edited her message (15-minute window). */
          edited_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          read_at?: string | null;
          created_at?: string;
          reactions?: Json;
          reply_to_id?: string | null;
          email_notified_at?: string | null;
          edited_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      cv_reviews: {
        Row: {
          id: string;
          profile_id: string;
          source: CvSource;
          reviewer_id: string | null;
          language: string;
          score: number | null;
          summary: string | null;
          insights: Json;
          job_fit: Json | null;
          cv_text: string | null;
          cv_document_id: string | null;
          checked_file_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          source?: CvSource;
          reviewer_id?: string | null;
          language?: string;
          score?: number | null;
          summary?: string | null;
          insights?: Json;
          job_fit?: Json | null;
          cv_text?: string | null;
          cv_document_id?: string | null;
          checked_file_path?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cv_reviews"]["Insert"]>;
        Relationships: [];
      };
      interview_sessions: {
        Row: {
          id: string;
          profile_id: string;
          agent: InterviewAgent;
          tech_tags: string[];
          difficulty: InterviewDifficulty;
          status: InterviewStatus;
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          agent?: InterviewAgent;
          tech_tags?: string[];
          difficulty?: InterviewDifficulty;
          status?: InterviewStatus;
          created_at?: string;
          ended_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["interview_sessions"]["Insert"]>;
        Relationships: [];
      };
      interview_turns: {
        Row: { id: string; session_id: string; role: TurnRole; text: string; created_at: string };
        Insert: { id?: string; session_id: string; role: TurnRole; text: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["interview_turns"]["Insert"]>;
        Relationships: [];
      };
      interview_feedback: {
        Row: {
          id: string;
          session_id: string;
          overall_score: number | null;
          summary: string | null;
          strengths: Json;
          improvements: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          overall_score?: number | null;
          summary?: string | null;
          strengths?: Json;
          improvements?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interview_feedback"]["Insert"]>;
        Relationships: [];
      };
      user_ai_keys: {
        Row: {
          id: string;
          profile_id: string;
          provider: string;
          label: string | null;
          key_cipher: string;
          key_last4: string | null;
          status: string;
          last_error: string | null;
          created_at: string;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          provider?: string;
          label?: string | null;
          key_cipher: string;
          key_last4?: string | null;
          status?: string;
          last_error?: string | null;
          created_at?: string;
          last_used_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_ai_keys"]["Insert"]>;
        Relationships: [];
      };
      cv_documents: {
        Row: {
          id: string;
          profile_id: string;
          label: string;
          language: CvLanguage;
          file_path: string;
          file_name: string | null;
          created_at: string;
          /** The CV she marked as hers by default — one per member (partial unique index). */
          is_default: boolean;
        };
        Insert: {
          id?: string;
          profile_id: string;
          label: string;
          language?: CvLanguage;
          file_path: string;
          file_name?: string | null;
          created_at?: string;
          is_default?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["cv_documents"]["Insert"]>;
        Relationships: [];
      };
      content_links: {
        Row: {
          id: string;
          owner_type: ContentOwner;
          owner_id: string;
          kind: LinkKind;
          title: string;
          url: string;
          sort_order: number;
          created_at: string;
          /** The course unit (קוביה) this link belongs to; legacy links have none. */
          unit_id: string | null;
        };
        Insert: {
          id?: string;
          owner_type: ContentOwner;
          owner_id: string;
          kind?: LinkKind;
          title: string;
          url: string;
          sort_order?: number;
          created_at?: string;
          unit_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["content_links"]["Insert"]>;
        Relationships: [];
      };
      course_units: {
        Row: {
          id: string;
          course_id: string;
          name: string;
          year: number | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          name: string;
          year?: number | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_units"]["Insert"]>;
        Relationships: [];
      };
      content_shares: {
        Row: {
          /** The address this share was granted to (may differ from the current one). */
          granted_email?: string | null;
          id: string;
          owner_type: ContentOwner;
          owner_id: string;
          profile_id: string;
          status: ShareStatus;
          created_at: string;
          shared_at: string | null;
          revoked_at: string | null;
          /** An admin handed her this course on purpose — it outlives her enrolment. */
          granted_manually: boolean;
        };
        Insert: {
          id?: string;
          owner_type: ContentOwner;
          owner_id: string;
          profile_id: string;
          status?: ShareStatus;
          created_at?: string;
          shared_at?: string | null;
          revoked_at?: string | null;
          granted_email?: string | null;
          granted_manually?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["content_shares"]["Insert"]>;
        Relationships: [];
      };
      /**
       * Free-tier reads. Same rows as `sessions`/`recordings` minus the paid
       * goods (zoom_url / video_url), so a member without a subscription has
       * nothing to leak even straight from the API.
       */
      sessions_public: {
        Row: Omit<
          Database["public"]["Tables"]["sessions"]["Row"],
          "zoom_url" | "leader_id" | "materials_url"
        >;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      recordings_public: {
        Row: Omit<Database["public"]["Tables"]["recordings"]["Row"], "video_url">;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /**
       * Every time a member opens course/session material. `owner_type`/
       * `owner_id` are what an admin actually reads ("she watched this
       * session"); `link_id` is the specific video when there is one, and is
       * nullable so deleting a link never erases the history.
       * The owner columns land with supabase/_content_access_log.sql — the app
       * falls back to the legacy {link_id, profile_id} insert until it runs.
       */
      content_views: {
        Row: {
          id: string;
          link_id: string | null;
          profile_id: string;
          created_at: string;
          owner_type?: ContentOwner | null;
          owner_id?: string | null;
          /** How she got in: unlock | embed | open. */
          source?: string | null;
        };
        Insert: {
          id?: string;
          link_id?: string | null;
          profile_id: string;
          created_at?: string;
          owner_type?: ContentOwner | null;
          owner_id?: string | null;
          source?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["content_views"]["Insert"]>;
        Relationships: [];
      };
      /**
       * Admin rollup of `content_views`: member × content → how many opens,
       * first and last. Admin-only inside the view itself (is_admin()), the
       * same pattern as `sessions_public`.
       */
      content_open_stats: {
        Row: {
          profile_id: string;
          owner_type: ContentOwner;
          owner_id: string;
          opens: number;
          first_open: string;
          last_open: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          target_type: ReportTarget;
          target_id: string;
          reporter_id: string;
          reason: string | null;
          status: ReportStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          target_type: ReportTarget;
          target_id: string;
          reporter_id: string;
          reason?: string | null;
          status?: ReportStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [];
      };
      personal_emails: {
        Row: {
          id: string;
          profile_id: string;
          sender_id: string | null;
          kind: string; // 'personal' | 'mentor_decline'
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          sender_id?: string | null;
          kind?: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["personal_emails"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      /**
       * What one member may see about another (supabase/_community_v2.sql).
       * Deliberately narrow: no `status` and no `member_tier`, so nobody can
       * tell who pays. Read-only — the directory reads this, never `profiles`.
       */
      members_directory: {
        Row: {
          id: string;
          full_name: string;
          first_name: string | null;
          avatar_initials: string | null;
          specialization: string | null;
          region: string | null;
          role: UserRole;
          bio: string | null;
          created_at: string;
          /** Really paying — activated paid / live sub / Nedarim payers list. */
          is_subscriber: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      /** Admin-only: payers on the external list with no auth account yet. */
      admin_unregistered_payers_count: { Args: Record<string, never>; Returns: number | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_mentor: { Args: Record<string, never>; Returns: boolean };
      is_member: { Args: Record<string, never>; Returns: boolean };
      has_active_sub: { Args: Record<string, never>; Returns: boolean };
      bump_ai_key_usage: { Args: { p_key: string; p_error?: boolean }; Returns: undefined };
      in_conversation: { Args: { conv: string }; Returns: boolean };
      owns_interview: { Args: { sess: string }; Returns: boolean };
      /** Scale foundations (2026-08-29) — service-role only. */
      member_emails: {
        Args: { p_ids: string[] };
        Returns: { id: string; email: string | null }[];
      };
      auth_user_id_by_email: { Args: { p_email: string }; Returns: string | null };
      digest_unread_counts: {
        Args: Record<string, never>;
        Returns: { recipient: string; unread: number; senders: string[] }[];
      };
      job_app_counts: {
        Args: Record<string, never>;
        Returns: { job_id: string; total: number; new_count: number }[];
      };
      mentor_answer_counts: {
        Args: { p_ids: string[] };
        Returns: { author_id: string; answers: number }[];
      };
      analytics_owner_totals: {
        Args: Record<string, never>;
        Returns: {
          owner_type: string;
          owner_id: string;
          opens: number;
          uniques: number;
          last_open: string | null;
        }[];
      };
      analytics_summary: {
        Args: Record<string, never>;
        Returns: { active_learners: number; total_opens: number }[];
      };
      match_answer_ids: {
        Args: { p_question: string; p_values: string[] };
        Returns: { profile_id: string }[];
      };
      match_answer_text: {
        Args: { p_question: string; p_needle: string };
        Returns: { profile_id: string }[];
      };
      search_juniors: {
        Args: { p_q: string; p_tech: string; p_min_years: number; p_limit?: number };
        Returns: {
          id: string;
          full_name: string;
          avatar_initials: string | null;
          specialization: string | null;
          years: number | null;
          tech: string[];
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      member_tier: MemberTier;
      profile_status: ProfileStatus;
      subscription_plan: SubscriptionPlan;
      subscription_status: SubscriptionStatus;
      payment_status: PaymentStatus;
      mentor_availability: MentorAvailability;
      field_type: FieldType;
      question_scope: QuestionScope;
      taxonomy_kind: TaxonomyKind;
      post_kind: PostKind;
      post_intent: PostIntent;
      post_status: PostStatus;
      reaction_kind: ReactionKind;
      report_target: ReportTarget;
      report_status: ReportStatus;
      job_source: JobSource;
      job_status: JobStatus;
      employment_type: EmploymentType;
      application_status: ApplicationStatus;
      enrollment_status: EnrollmentStatus;
      session_status: SessionStatus;
      cv_source: CvSource;
      interview_agent: InterviewAgent;
      interview_difficulty: InterviewDifficulty;
      interview_status: InterviewStatus;
      turn_role: TurnRole;
    };
    CompositeTypes: Record<never, never>;
  };
}

// Convenience row aliases
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type ConfigQuestion = Database["public"]["Tables"]["config_questions"]["Row"];
export type ConfigTaxonomy = Database["public"]["Tables"]["config_taxonomies"]["Row"];
export type Article = Database["public"]["Tables"]["articles"]["Row"];
export type ProfileAnswer = Database["public"]["Tables"]["profile_answers"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Application = Database["public"]["Tables"]["applications"]["Row"];
export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
export type Recording = Database["public"]["Tables"]["recordings"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type CvDocument = Database["public"]["Tables"]["cv_documents"]["Row"];
export type ContentLink = Database["public"]["Tables"]["content_links"]["Row"];
export type CourseUnit = Database["public"]["Tables"]["course_units"]["Row"];
export type ContentShare = Database["public"]["Tables"]["content_shares"]["Row"];
export type ContentView = Database["public"]["Tables"]["content_views"]["Row"];
export type ContentOpenStat = Database["public"]["Tables"]["content_open_stats"]["Row"];
