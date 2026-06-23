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
export type ApplicationStatus = "draft" | "submitted" | "in_review" | "accepted" | "rejected";
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

type Timestamps = { created_at: string; updated_at: string };

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_initials: string | null;
          region: string | null;
          specialization: string | null;
          bio: string | null;
          links: Json;
          role: UserRole;
          member_tier: MemberTier;
          status: ProfileStatus;
          is_experienced: boolean;
          is_vip: boolean;
          internal_notes: string | null;
          profile_completed: boolean;
        } & Timestamps;
        Insert: {
          id: string;
          full_name?: string;
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
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
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
          sort_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: TaxonomyKind;
          value: string;
          label_he: string;
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
        } & Timestamps;
        Insert: { id?: string; post_id: string; author_id: string; body: string };
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
          logo_variant?: number;
          is_visible?: boolean;
          status?: JobStatus;
          posted_by?: string | null;
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
        } & Timestamps;
        Insert: {
          id?: string;
          job_id: string;
          applicant_id: string;
          status?: ApplicationStatus;
          note?: string | null;
          submitted_at?: string;
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
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
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
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          body: string;
          read_at?: string | null;
          created_at?: string;
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
        };
        Insert: {
          id?: string;
          profile_id: string;
          label: string;
          language?: CvLanguage;
          file_path: string;
          file_name?: string | null;
          created_at?: string;
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
        };
        Update: Partial<Database["public"]["Tables"]["content_links"]["Insert"]>;
        Relationships: [];
      };
      content_shares: {
        Row: {
          id: string;
          owner_type: ContentOwner;
          owner_id: string;
          profile_id: string;
          status: ShareStatus;
          created_at: string;
          shared_at: string | null;
          revoked_at: string | null;
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
        };
        Update: Partial<Database["public"]["Tables"]["content_shares"]["Insert"]>;
        Relationships: [];
      };
      content_views: {
        Row: { id: string; link_id: string; profile_id: string; created_at: string };
        Insert: { id?: string; link_id: string; profile_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["content_views"]["Insert"]>;
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
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_mentor: { Args: Record<string, never>; Returns: boolean };
      has_active_sub: { Args: Record<string, never>; Returns: boolean };
      in_conversation: { Args: { conv: string }; Returns: boolean };
      owns_interview: { Args: { sess: string }; Returns: boolean };
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
export type ContentShare = Database["public"]["Tables"]["content_shares"]["Row"];
