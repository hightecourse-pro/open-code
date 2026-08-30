// "כך רואות אותך המגייסות" — the member's OWN portal card, rendered for her.
//
// PRIVACY: the data comes from loadCandidates(), the exact function the
// employer portal reads — same listing gate, same employer_visible question
// filter. What she sees here is literally what a client sees, nothing more.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { Alert } from "@/components/ui";
import { loadCandidates } from "@/lib/portal/candidates";
import { CandidateProfileCard } from "@/components/patterns/candidate-profile-card";
import { requireCommunityAccess } from "@/lib/auth";

export const metadata: Metadata = { title: "תצוגה מקדימה — הפורטל" };
export const dynamic = "force-dynamic";

export default async function ProfilePreviewPage() {
  const profile = await requireCommunityAccess();
  // Staff aren't portal candidates — the team view renders their card anyway
  // (the owner, 30/8: "ככה נראה הפרופיל שלי כצוות" was an empty message).
  const { candidates } = await loadCandidates({
    includeMentors: true,
    everyoneForTeam: profile.role === "admin",
  });
  const me = candidates.find((c) => c.id === profile.id) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/profile"
        className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-purple hover:underline w-fit"
      >
        <ArrowRight size={15} />
        חזרה לפרופיל
      </Link>

      <div className="flex items-center gap-2.5 bg-tint-purple/60 border border-[#DDC9EC] rounded-md p-3 px-4 text-[13.5px] text-ink-900">
        <Eye size={16} className="text-brand-purple shrink-0" />
        <span>
          <b>תצוגה מקדימה:</b> ככה בדיוק רואות אותך המגייסות בפורטל המעסיקים — הפרופיל המלא
          שלך, בנוי להחליף את קורות החיים. אצלן מופיע גם כפתור להורדת קורות החיים.
        </span>
      </div>

      {!me ? (
        <Alert variant="info" title="הפרופיל שלך לא מוצג כרגע בפורטל">
          {profile.portal_listed === false
            ? "בחרת להסתיר את הפרופיל מהפורטל — אפשר להחזיר אותו מהגדרת החשיפה בעמוד הפרופיל."
            : "כדי להופיע בפורטל צריך פרופיל מלא וסטטוס פעיל. ברגע שזה קורה — המגייסות רואות אותך."}
        </Alert>
      ) : (
        <CandidateProfileCard candidate={me} />
      )}
    </div>
  );
}

