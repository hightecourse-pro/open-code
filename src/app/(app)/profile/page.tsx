import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar, Badge } from "@/components/ui";
import { ProfileForm } from "@/components/patterns/profile-form";
import { DigestPreferences } from "@/components/patterns/digest-preferences";
import { DriveEmailForm } from "@/components/patterns/drive-email-form";
import { PortalVisibility } from "@/components/patterns/portal-visibility";
import { getTaxonomyOptions } from "@/lib/taxonomies";
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

  const [{ data: questions }, { data: answers }, { data: priv }, taxonomyOptions] = await Promise.all([
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
      .select("drive_email, drive_email_requested_at")
      .eq("profile_id", profile.id)
      .maybeSingle(),
    getTaxonomyOptions(),
  ]);

  const answerMap: Record<string, unknown> = {};
  for (const a of answers ?? []) answerMap[a.question_id] = a.value;

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

      <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm">
        <h2 className="font-display text-lg font-bold text-ink-1000 mb-1">פרטי הפרופיל</h2>
        <p className="t-body-sm text-ink-500 mb-4">המידע הזה עוזר לנו להתאים לך משרות, קורסים ומנטוריות.</p>
        <ProfileForm
          firstName={profile.first_name ?? profile.full_name?.split(" ")[0] ?? ""}
          lastName={profile.last_name ?? profile.full_name?.split(" ").slice(1).join(" ") ?? ""}
          questions={questions ?? []}
          answers={answerMap}
          taxonomyOptions={taxonomyOptions}
        />
      </div>

      <PortalVisibility listed={profile.portal_listed !== false} />

      <DriveEmailForm
        current={priv?.drive_email ?? null}
        loginEmail={user?.email ?? null}
        wasRequested={!!priv?.drive_email_requested_at}
      />

      <DigestPreferences current={profile.digest_frequency ?? "daily"} />
    </div>
  );
}
