// The TEAM's view of a member's full profile (the owner, 2026-08-30:
// "לצוות ניתן לראות את הפרופיל ולהשתמש בהכל") — the same CV-replacing card
// the employer portal renders, but for EVERY member, portal-hidden included,
// PLUS her contact details (phone + email), which only the team sees
// (the owner, 31/8: "תוסיף בפרופיל גם טלפון ומייל").
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Eye } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const admin = createAdminClient();
  const [{ candidates }, { data: authUser }, { data: phoneRow }] = await Promise.all([
    loadCandidates({ includeMentors: true, everyoneForTeam: true }),
    admin.auth.admin.getUserById(id),
    // Phone is NOT employer_visible, so loadCandidates never returns it —
    // the team fetches it directly.
    admin
      .from("profile_answers")
      .select("value, config_questions!inner(key)")
      .eq("profile_id", id)
      .eq("config_questions.key", "phone")
      .maybeSingle(),
  ]);
  const member = candidates.find((c) => c.id === id) ?? null;
  if (!member) notFound();

  const phone = typeof phoneRow?.value === "string" ? phoneRow.value : null;
  const email = authUser?.user?.email ?? null;

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
          <b>הפרופיל המלא</b> — כמו שמגייסת רואה, בתוספת טלפון ומייל שמוצגים לצוות בלבד.
        </span>
      </div>
      <CandidateProfileCard candidate={member} teamContact={{ phone, email }} />
    </div>
  );
}
