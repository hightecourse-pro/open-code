// The TEAM's view of a member's full profile (the owner, 2026-08-30:
// "לצוות ניתן לראות את הפרופיל ולהשתמש בהכל") — the same CV-replacing card
// the employer portal renders, but for EVERY member, portal-hidden included.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Eye } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { loadCandidates } from "@/lib/portal/candidates";
import { CandidateProfileCard } from "@/components/patterns/candidate-profile-card";

export const metadata: Metadata = { title: "הפרופיל המלא" };
export const dynamic = "force-dynamic";

export default async function AdminMemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const { candidates } = await loadCandidates({ includeMentors: true, everyoneForTeam: true });
  const member = candidates.find((c) => c.id === id) ?? null;
  if (!member) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/admin/members/${id}`}
        className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-purple hover:underline w-fit"
      >
        <ArrowRight size={15} />
        חזרה לתיק החברה
      </Link>
      <div className="flex items-center gap-2.5 bg-tint-purple/60 border border-[#DDC9EC] rounded-md p-3 px-4 text-[13.5px] text-ink-900">
        <Eye size={16} className="text-brand-purple shrink-0" />
        <span>
          <b>הפרופיל המלא</b> — בדיוק כמו שהוא מוצג בפורטל המעסיקים (גם אם החברה בחרה להסתיר
          את עצמה מהפורטל, הצוות רואה).
        </span>
      </div>
      <CandidateProfileCard candidate={member} />
    </div>
  );
}
