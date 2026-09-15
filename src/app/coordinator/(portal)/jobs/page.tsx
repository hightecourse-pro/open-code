import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, MapPin } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCoordinator } from "@/lib/coordinators";
import {
  loadGraduates,
  loadJobsWithHerApplicants,
  type CoordinatorJob,
} from "@/lib/coordinator-data";

export const metadata: Metadata = { title: "משרות והגשות" };
export const dynamic = "force-dynamic";

const EMPLOYMENT_HE: Record<string, string> = {
  full: "משרה מלאה",
  part: "חלקית",
  student: "סטודנטית",
  freelance: "פרילנס",
};

/**
 * The status through the coordinator's eyes (the owner, 15/9): SHE applied
 * ("הגישה מועמדות" — we didn't submit anything yet); once WE forwarded her,
 * "הוגשה ע"י קוד פתוח" in green; a hire gets its own גויסה marker.
 */
function ApplicantStatus({ a }: { a: CoordinatorJob["applicants"][number] }) {
  if (a.status === "hired")
    return <Badge variant="mint">גויסה 🎉</Badge>;
  if (a.sentByUs)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-tint-mint text-success border border-[#BFE4D1] px-2 py-0.5 text-[11px] font-bold">
        הוגשה ע&quot;י קוד פתוח ✓
        {a.status === "interview" && <span className="font-semibold">· בראיונות</span>}
        {a.status === "exam" && <span className="font-semibold">· במבחן</span>}
      </span>
    );
  const label =
    a.status === "rejected"
      ? "לא התקדם"
      : a.status === "declined"
        ? "ביטלה את המועמדות"
        : a.status === "waitlisted"
          ? "בהמתנה"
          : "הגישה מועמדות";
  return <span className="text-ink-400 text-[12px]">· {label}</span>;
}

/** Only jobs her graduates applied to through the site (the owner, 15/9). */
export default async function CoordinatorJobsPage() {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");

  const graduates = await loadGraduates(me.institutions);
  const jobs = await loadJobsWithHerApplicants(graduates.map((g) => g.id));

  return (
    <section className="bg-white border border-ink-200 rounded-[16px] p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-2">
        <Briefcase size={18} className="text-brand-purple" /> ההגשות של הבוגרות שלך ({jobs.length})
      </h2>
      <p className="text-[12px] text-ink-500 mb-2">
        משרות שבוגרות מהמוסדות שלך הגישו אליהן מועמדות דרך האתר.{" "}
        <span className="text-success font-semibold">בירוק</span> — מועמדות שקוד פתוח הגישה
        למעסיק.
      </p>
      <div className="flex flex-col">
        {jobs.map((j) => (
          <div key={j.id} className="py-3 border-b border-ink-100 last:border-b-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-ink-1000">{j.title}</span>
              {j.company && <span className="text-[12.5px] text-ink-500">{j.company}</span>}
              {j.location && (
                <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-500">
                  <MapPin size={11} /> {j.location}
                </span>
              )}
              {j.employment_type && EMPLOYMENT_HE[j.employment_type] && (
                <Badge variant="gray">{EMPLOYMENT_HE[j.employment_type]}</Badge>
              )}
              {j.status !== "open" && <Badge variant="gray">נסגרה</Badge>}
              <Badge variant="purple">{j.applicants.length} מהבוגרות שלך</Badge>
            </div>

            {j.descriptionText && (
              <details className="mt-1 group">
                <summary className="text-[12px] font-semibold text-brand-purple cursor-pointer w-fit list-none [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">פרטי המשרה ▾</span>
                  <span className="hidden group-open:inline">הסתרת הפרטים ▴</span>
                </summary>
                <p className="text-[12.5px] text-ink-600 leading-relaxed whitespace-pre-line mt-1 max-w-prose">
                  {j.descriptionText.slice(0, 1200)}
                  {j.descriptionText.length > 1200 ? "…" : ""}
                </p>
              </details>
            )}

            <div className="text-[13px] text-ink-800 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              {j.applicants.map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5">
                  <Link
                    href={`/coordinator/member/${a.id}`}
                    className="font-medium hover:text-brand-purple hover:underline"
                  >
                    {a.full_name}
                  </Link>
                  <ApplicantStatus a={a} />
                </span>
              ))}
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <p className="text-ink-500 text-sm py-2">עוד אין הגשות של בוגרות מהמוסדות שלך.</p>
        )}
      </div>
    </section>
  );
}
