import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar, Badge } from "@/components/ui";
import { ProfileForm } from "@/components/patterns/profile-form";
import { EmploymentCard } from "@/components/patterns/employment-card";
import { DigestPreferences } from "@/components/patterns/digest-preferences";
import { DriveEmailForm } from "@/components/patterns/drive-email-form";
import { PortalVisibility } from "@/components/patterns/portal-visibility";
import { requestMentorRole } from "./actions";
import { MENTOR_REQUEST_SUBJECT } from "@/lib/mentor-request";
import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { getTaxonomyOptions } from "@/lib/taxonomies";
import { mentorScores } from "@/lib/mentor-score";
import type { QuestionScope } from "@/types/database";

export const metadata: Metadata = { title: "הפרופיל שלי" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const scope: QuestionScope[] =
    profile.role === "mentor" ? ["all", "mentor"] : ["all", "junior"];

  const [
    { data: questions },
    { data: answers },
    { data: priv },
    { data: employmentReq },
    taxonomyOptions,
  ] = await Promise.all([
    supabase
      .from("config_questions")
      .select("*")
      .in("scope", scope)
      // Active questions, plus the structural experience gate even if toggled off.
      .or("active.eq.true,key.eq.has_experience")
      .order("sort_order", { ascending: true }),
    supabase.from("profile_answers").select("question_id, value").eq("profile_id", profile.id),
    // Owner-only row — her Drive address isn't on the shared profiles table.
    supabase
      .from("member_private")
      .select("drive_email, drive_email_requested_at, workplace")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    // Her latest employment accompaniment assignment (admin-assigned) — the
    // card shows the mentor's name with a link to chat.
    supabase
      .from("mentor_requests")
      .select("assigned_mentor_id")
      .eq("profile_id", profile.id)
      .eq("kind", "employment")
      .not("assigned_mentor_id", "is", null)
      // Only an assignment the mentor ACCEPTED is presented to the member.
      .not("mentor_accepted_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getTaxonomyOptions(),
  ]);

  // A mentor's own score — with what the points are worth (400 = course gift).
  const myScore =
    profile.role === "mentor"
      ? (await mentorScores([profile.id])).get(profile.id) ?? null
      : null;

  // Is her mentor request already sitting with the team?
  const { data: mentorReq } =
    profile.role === "junior" && profile.is_experienced
      ? await supabase
          .from("member_requests")
          .select("id")
          .eq("profile_id", profile.id)
          .eq("subject", MENTOR_REQUEST_SUBJECT)
          .eq("status", "open")
          .maybeSingle()
      : { data: null };
  const mentorRequestOpen = !!mentorReq;

  const answerMap: Record<string, unknown> = {};
  for (const a of answers ?? []) answerMap[a.question_id] = a.value;

  // At least one CV is part of a complete junior profile (PM rule) — the
  // wizard collects one when she has none.
  const { count: cvCount } = await supabase
    .from("cv_documents")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id);
  const requireCv = profile.role === "junior" && (cvCount ?? 0) === 0;

  // Resolve the assigned mentor's name for the employment card.
  let employmentMentorName: string | null = null;
  if (employmentReq?.assigned_mentor_id) {
    const { data: mentor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", employmentReq.assigned_mentor_id)
      .maybeSingle();
    employmentMentorName = mentor?.full_name ?? null;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar
          size="xl"
          tone={profile.role === "mentor" ? "gold" : "pink"}
          crown={profile.role === "mentor"}
          initials={profile.avatar_initials || profile.full_name.slice(0, 1) || "ק"}
        />
        <div>
          <h1 className="font-display text-[26px] font-black text-ink-1000">{profile.full_name}</h1>
          <div className="flex gap-2 mt-1">
            {profile.role === "mentor" && <Badge variant="mentor">👑 מנטורית</Badge>}
            {profile.role === "admin" && (
              <span className="bg-ink-1000 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                צוות
              </span>
            )}
            {profile.specialization && <Badge variant="purple">{profile.specialization}</Badge>}
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-[#DDC9EC] rounded-[18px] p-6 shadow-sm">
        {/* An explicit frame + how-to line: the wizard mid-page read as
            "where do I actually edit?" (PM feedback). */}
        <h2 className="font-display text-lg font-bold text-ink-1000 mb-1 flex items-center gap-2">
          <Pencil size={17} className="text-brand-purple" /> כאן מעדכנים את הפרופיל
        </h2>
        <p className="t-body-sm text-ink-500 mb-4">
          עוברים שלב-שלב עם &quot;הבא&quot;, משנים מה שרוצים, ובשלב האחרון לוחצות{" "}
          <b>&quot;סיום ושמירה&quot;</b> — שום דבר לא נשמר לפני זה. המידע עוזר לנו להתאים לך
          משרות, קורסים ומנטוריות.
        </p>
        <ProfileForm
          firstName={profile.first_name ?? profile.full_name?.split(" ")[0] ?? ""}
          lastName={profile.last_name ?? profile.full_name?.split(" ").slice(1).join(" ") ?? ""}
          questions={questions ?? []}
          answers={answerMap}
          taxonomyOptions={taxonomyOptions}
          requireCv={requireCv}
          // A completed profile is never asked the experience gate afresh —
          // profiles.is_experienced stands in when no answer row exists.
          initialExperienced={profile.profile_completed ? profile.is_experienced === true : null}
        />
      </div>

      <EmploymentCard
        foundJob={profile.found_job}
        workplace={priv?.workplace ?? null}
        hiredViaUs={profile.hired_via_us}
        mentorName={employmentMentorName}
      />

      {/* "המנוי שלי" moved to its own page (PM) — /subscription in the menu. */}

      <PortalVisibility listed={profile.portal_listed !== false} />

      {/* A mentor's points — and what they're worth (the owner, 2026-08-26:
          400 points = a course from the library, as a gift). */}
      {profile.role === "mentor" && (
        <div className="border border-[#EAD9A8] bg-tint-warm/60 rounded-[16px] p-4 flex items-center gap-4 flex-wrap">
          <div className="font-display font-black text-[26px] text-[#8C5E0E] shrink-0">
            ⭐ {myScore?.score ?? 0} נק&#39;
          </div>
          <div className="flex-1 min-w-[220px] text-[13px] text-ink-700 leading-relaxed">
            <b className="text-ink-1000">הנקודות שלך שוות קורס 🎁</b> — ב-400 נקודות מגיע לך קורס
            מתנה מספריית הקורסים של הייטקורס. צוברים על כל תשובה בפורום ועל כל ליווי אישי
            {myScore
              ? ` (עד עכשיו: ${myScore.answers} תשובות ו-${myScore.assignments} ליוויים).`
              : "."}
            {(myScore?.score ?? 0) >= 400 && " הגעת! כתבי לנו ונפתח לך את הקורס שבחרת 💜"}
          </div>
        </div>
      )}

      {/* Experienced members may ask to become mentors right here (the
          owner's ask 2026-08-26) — a request to the team, not a self-serve
          switch: she keeps her paid membership until someone approves. */}
      {profile.role === "junior" && profile.is_experienced && (
        <div className="border border-[#EAD9A8] bg-tint-warm/60 rounded-[16px] p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <div className="font-display font-bold text-[14.5px] text-ink-1000">
              רוצה להצטרף כמנטורית? 👑
            </div>
            <p className="text-[13px] text-ink-700 mt-0.5">
              בתור בעלת ניסיון את מוזמנת לתרום לקהילה — מענה לשאלות, ליווי אישי והאקתונים. נעבור
              על הבקשה ונחזור אלייך.
            </p>
          </div>
          {mentorRequestOpen ? (
            <span className="text-[13px] font-semibold text-[#8C5E0E]">
              הבקשה שלך אצלנו — נעדכן אותך ממש בקרוב 💜
            </span>
          ) : (
            <form action={requestMentorRole}>
              <button
                type="submit"
                className="font-display font-semibold text-[13px] px-4 py-2 rounded-md bg-white text-[#8C5E0E] border-[1.5px] border-[#E5A93C] hover:bg-tint-warm transition-colors"
              >
                הגשת בקשה למנטורית
              </button>
            </form>
          )}
        </div>
      )}

      {/* The mirror: exactly what a recruiter sees on the portal (PM ask). */}
      <Link
        href="/profile/preview"
        className="flex items-center gap-2.5 bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm hover:border-brand-purple transition-colors"
      >
        <Eye size={17} className="text-brand-purple shrink-0" />
        <span className="flex-1 text-[13.5px] text-ink-900">
          <b className="font-display">איך אני נראית למגייסות?</b>
          <span className="text-ink-500"> — תצוגה מקדימה של הפרופיל שלך כפי שהוא מוצג בפורטל המעסיקים.</span>
        </span>
        <span className="font-display font-semibold text-brand-purple text-[13px] whitespace-nowrap">
          לתצוגה ←
        </span>
      </Link>

      <DriveEmailForm
        current={priv?.drive_email ?? null}
        loginEmail={user?.email ?? null}
        wasRequested={!!priv?.drive_email_requested_at}
      />

      <DigestPreferences current={profile.digest_frequency ?? "daily"} />
    </div>
  );
}
