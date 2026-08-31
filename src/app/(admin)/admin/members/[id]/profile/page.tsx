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
  // A member who hasn't completed the questionnaire (or was blocked) has no
  // candidate card — say so instead of a bare 404 (the owner, 1/9: the eye
  // icon on a mid-questionnaire member landed on "page not found").
  if (!member) {
    const { data: bare } = await admin
      .from("profiles")
      .select("full_name, status, profile_completed")
      .eq("id", id)
      .maybeSingle();
    if (!bare) notFound();
    return (
      <div className="flex flex-col gap-4">
        <Link
          href={`/admin/members/${id}`}
          className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-purple hover:underline w-fit"
        >
          <ArrowRight size={15} />
          חזרה לתיק החברה
        </Link>
        <div className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-ink-700 text-sm leading-relaxed">
          <b className="text-ink-1000">{bare.full_name}</b>{" "}
          {bare.status === "rejected"
            ? "— החשבון חסום/נדחה, ולכן אין פרופיל להצגה."
            : "עדיין באמצע מילוי השאלון — ברגע שתסיים, הפרופיל המלא יופיע כאן בדיוק כמו שמגייסת תראה אותו."}
        </div>
      </div>
    );
  }

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
