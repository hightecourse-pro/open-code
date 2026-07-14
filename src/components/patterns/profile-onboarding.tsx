import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui";
import { ProfileForm } from "./profile-form";
import { getTaxonomyOptions } from "@/lib/taxonomies";
import type { Profile, QuestionScope } from "@/types/database";

/**
 * First-login mandatory profile gate. Rendered by the (app) layout instead of
 * the community until `profile_completed` is true. Saving the form flips the
 * flag and redirects into the feed.
 */
export async function ProfileOnboarding({ profile }: { profile: Profile }) {
  const supabase = await createClient();

  const scope: QuestionScope[] =
    profile.role === "mentor" ? ["all", "mentor"] : ["all", "junior"];

  const [{ data: questions }, { data: answers }, taxonomyOptions] = await Promise.all([
    supabase
      .from("config_questions")
      .select("*")
      .in("scope", scope)
      // Active questions, plus the structural experience gate even if toggled off.
      .or("active.eq.true,key.eq.has_experience")
      .order("sort_order", { ascending: true }),
    supabase.from("profile_answers").select("question_id, value").eq("profile_id", profile.id),
    getTaxonomyOptions(),
  ]);

  const answerMap: Record<string, unknown> = {};
  for (const a of answers ?? []) answerMap[a.question_id] = a.value;

  return (
    <div className="min-h-screen bg-tint-purple flex items-start justify-center p-4 py-10" dir="rtl">
      <div className="w-full max-w-2xl bg-white border border-ink-200 rounded-[22px] p-7 shadow-lg">
        <div className="flex items-center gap-3 mb-5">
          <Logo width={120} />
          <div>
            <span className="font-mono text-xs text-brand-pink-deep">&lt;ברוכה הבאה/&gt;</span>
            <h1 className="font-display text-[24px] font-black text-ink-1000 leading-tight">
              כמה פרטים ונצא לדרך 💜
            </h1>
          </div>
        </div>
        <p className="t-body-sm text-ink-500 mb-5">
          המידע הזה עוזר לנו להתאים לך משרות, קורסים ומנטוריות — וגם לסנן הזדמנויות במיוחד בשבילך.
          אפשר יהיה לעדכן הכול בכל רגע מעמוד הפרופיל.
        </p>
        <ProfileForm
          firstName={profile.first_name ?? profile.full_name?.split(" ")[0] ?? ""}
          lastName={profile.last_name ?? profile.full_name?.split(" ").slice(1).join(" ") ?? ""}
          questions={questions ?? []}
          answers={answerMap}
          taxonomyOptions={taxonomyOptions}
        />
      </div>
    </div>
  );
}
