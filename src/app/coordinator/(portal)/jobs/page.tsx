import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { Badge } from "@/components/ui";
import { getCoordinator } from "@/lib/coordinators";
import { loadGraduates, loadJobsWithHerApplicants } from "@/lib/coordinator-data";

export const metadata: Metadata = { title: "משרות והגשות" };
export const dynamic = "force-dynamic";

const APP_STATUS_HE: Record<string, string> = {
  submitted: "הוגשה",
  in_review: "בבדיקה",
  accepted: "אושרה",
  sent: "נשלחה ללקוח",
  interview: "בראיונות",
  exam: "במבחן",
  hired: "התקבלה 🎉",
  rejected: "לא התקדם",
  declined: "בוטלה",
  waitlisted: "בהמתנה",
};

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
        משרות שבוגרות מהמוסדות שלך הגישו אליהן מועמדות דרך האתר — עם הסטטוס של כל הגשה.
      </p>
      <div className="flex flex-col">
        {jobs.map((j) => (
          <div key={j.id} className="py-2.5 border-b border-ink-100 last:border-b-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-ink-900">{j.title}</span>
              {j.status !== "open" && <Badge variant="gray">נסגרה</Badge>}
              <Badge variant="purple">{j.applicants.length} מהבוגרות שלך</Badge>
            </div>
            <div className="text-[12.5px] text-ink-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {j.applicants.map((a) => (
                <Link
                  key={a.id}
                  href={`/coordinator/member/${a.id}`}
                  className="hover:text-brand-purple hover:underline"
                >
                  {a.full_name}
                  <span className="text-ink-400"> · {APP_STATUS_HE[a.status] ?? a.status}</span>
                </Link>
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
