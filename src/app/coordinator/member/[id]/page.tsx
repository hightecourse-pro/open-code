import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Avatar, Badge, Logo } from "@/components/ui";
import { getCoordinator } from "@/lib/coordinators";
import {
  loadGraduates,
  loadOptionLabels,
  loadReviews,
} from "@/lib/coordinator-data";
import { loadCandidates } from "@/lib/portal/candidates";
import { CandidateProfileCard } from "@/components/patterns/candidate-profile-card";
import { CoordinatorReviewForm } from "./review-form";

export const metadata: Metadata = { title: "פרופיל בוגרת" };
export const dynamic = "force-dynamic";

export default async function CoordinatorMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");
  const { id } = await params;

  // She reaches ONLY her own graduates — anything else is a 404, not a hint.
  const graduates = await loadGraduates(me.institutions);
  const grad = graduates.find((g) => g.id === id);
  if (!grad) notFound();

  const [labels, reviews] = await Promise.all([loadOptionLabels(), loadReviews(me.id)]);
  const review = reviews.get(id) ?? null;

  // The polished candidate profile when she completed it; a clean summary
  // card otherwise (mid-questionnaire graduates have little to show yet).
  const { candidates } = await loadCandidates({ includeMentors: true });
  const candidate = candidates.find((c) => c.id === id) ?? null;

  return (
    <div className="min-h-screen bg-ink-50" dir="rtl">
      <header className="bg-white border-b border-ink-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Logo width={100} />
          <Link
            href="/coordinator"
            className="ms-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-purple hover:underline"
          >
            חזרה לכל הבוגרות <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* ─────────────────────────── the review — the reason she is here */}
        <section className="bg-white border border-[#DDC9EC] rounded-[18px] p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Avatar size="lg" initials={grad.avatar_initials || grad.full_name.slice(0, 1)} />
            <div>
              <h1 className="font-display text-[22px] font-black text-ink-1000">{grad.full_name}</h1>
              <div className="flex items-center gap-2 flex-wrap text-[12.5px] text-ink-500">
                {grad.specialization && <Badge variant="purple">{grad.specialization}</Badge>}
                {grad.yearValue && <span>מחזור {labels.years.get(grad.yearValue) ?? grad.yearValue}</span>}
                {grad.certificateValue && (
                  <span>· {labels.certificates.get(grad.certificateValue) ?? grad.certificateValue}</span>
                )}
                {grad.systemFoundJob && <Badge variant="mint">עובדת 🎉</Badge>}
              </div>
            </div>
          </div>
          <h2 className="font-display font-bold text-[15.5px] text-ink-1000 mb-2">חוות הדעת שלך</h2>
          <CoordinatorReviewForm profileId={id} existing={review} />
        </section>

        {/* ──────────────────────────────────────── her profile, read-only */}
        {candidate ? (
          <CandidateProfileCard candidate={candidate} />
        ) : (
          <section className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-ink-600 text-sm">
            הפרופיל המלא שלה יופיע כאן ברגע שתסיים למלא את השאלון בקהילה.
          </section>
        )}
      </main>
    </div>
  );
}
