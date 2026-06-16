import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { Avatar, Badge } from "@/components/ui";
import { ProfileForm } from "@/components/patterns/profile-form";
import type { QuestionScope } from "@/types/database";

export const metadata: Metadata = { title: "הפרופיל שלי" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const scope: QuestionScope[] =
    profile.role === "mentor" ? ["all", "mentor"] : ["all", "junior"];

  const [{ data: questions }, { data: answers }] = await Promise.all([
    supabase
      .from("config_questions")
      .select("*")
      .eq("active", true)
      .in("scope", scope)
      .order("sort_order", { ascending: true }),
    supabase.from("profile_answers").select("question_id, value").eq("profile_id", profile.id),
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
        <ProfileForm fullName={profile.full_name} questions={questions ?? []} answers={answerMap} />
      </div>
    </div>
  );
}
