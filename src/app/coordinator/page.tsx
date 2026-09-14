import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, GraduationCap, LogOut, PartyPopper } from "lucide-react";
import { Avatar, Badge, Button, Logo } from "@/components/ui";
import { getCoordinator } from "@/lib/coordinators";
import {
  loadGraduates,
  loadHires,
  loadJobsWithHerApplicants,
  loadOptionLabels,
  loadReviews,
  type Graduate,
} from "@/lib/coordinator-data";
import { coordinatorLogout } from "./actions";

export const metadata: Metadata = { title: "אזור הרכזות" };
export const dynamic = "force-dynamic";

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "Asia/Jerusalem",
});

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

export default async function CoordinatorDashboard() {
  const me = await getCoordinator();
  if (!me) redirect("/coordinator/login");

  const [labels, graduates, reviews] = await Promise.all([
    loadOptionLabels(),
    loadGraduates(me.institutions),
    loadReviews(me.id),
  ]);
  const gradIds = graduates.map((g) => g.id);
  const [jobs, hires] = await Promise.all([
    loadJobsWithHerApplicants(gradIds),
    loadHires(gradIds),
  ]);

  const yearLabel = (v: string | null) => (v ? (labels.years.get(v) ?? v) : "ללא שנת סיום");
  const certLabel = (v: string | null) => (v ? (labels.certificates.get(v) ?? v) : "");

  // institution → year (newest first) → [certificate →] graduates.
  const byInstitution = new Map<string, Graduate[]>();
  for (const g of graduates) {
    if (!byInstitution.has(g.institution)) byInstitution.set(g.institution, []);
    byInstitution.get(g.institution)!.push(g);
  }

  const groupYears = (list: Graduate[]) => {
    const years = new Map<string, Graduate[]>();
    for (const g of list) {
      const key = g.yearValue ?? "";
      if (!years.has(key)) years.set(key, []);
      years.get(key)!.push(g);
    }
    // Newest year first; the no-year bucket last.
    return [...years.entries()].sort((a, b) => {
      if (!a[0]) return 1;
      if (!b[0]) return -1;
      return b[0].localeCompare(a[0]);
    });
  };

  const GraduateRow = ({ g }: { g: Graduate }) => {
    const r = reviews.get(g.id);
    return (
      <Link
        href={`/coordinator/member/${g.id}`}
        className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 hover:bg-tint-purple/30 rounded-md px-2 -mx-2 transition-colors"
      >
        <Avatar size="sm" initials={g.avatar_initials || g.full_name.slice(0, 1)} />
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-ink-900 truncate">{g.full_name}</span>
          {g.specialization && <span className="block text-[11.5px] text-ink-500">{g.specialization}</span>}
        </span>
        {(g.systemFoundJob || r?.found_job === true) && (
          <Badge variant="mint">עובדת 🎉</Badge>
        )}
        {r && (r.communication || r.talent || r.note) ? (
          <span className="text-[11.5px] font-semibold text-[#8C5E0E]">
            ⭐ {[r.communication && `תקשורת ${r.communication}`, r.talent && `כישרון ${r.talent}`]
              .filter(Boolean)
              .join(" · ") || "חוות דעת ✓"}
          </span>
        ) : (
          <span className="text-[11.5px] text-brand-purple font-semibold">+ חוות דעת</span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-ink-50" dir="rtl">
      <header className="bg-white border-b border-ink-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Logo width={100} />
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-ink-1000 truncate">שלום {me.full_name.split(" ")[0]} 💜</div>
            <div className="text-[11.5px] text-ink-500 truncate">{me.institutions.join(" · ")}</div>
          </div>
          <form action={coordinatorLogout}>
            <Button type="submit" size="sm" variant="ghost">
              <LogOut size={14} /> יציאה
            </Button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-5">
        <p className="t-body-sm text-ink-500 -mb-1">
          מה שאת כותבת כאן — דירוגים, הערות ועדכוני תעסוקה — גלוי רק לך ולצוות קוד פתוח.
        </p>

        {/* ───────────────────────────── graduates, by year (and certificate) */}
        {[...byInstitution.entries()].map(([inst, list]) => {
          const certs = new Set(list.map((g) => g.certificateValue ?? ""));
          const splitByCert = certs.size > 1;
          return (
            <section key={inst} className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
              <h2 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-2">
                <GraduationCap size={18} className="text-brand-purple" />
                הבוגרות שלך{byInstitution.size > 1 ? ` — ${inst}` : ""} ({list.length})
              </h2>
              <p className="text-[12px] text-ink-500 mb-2">לחיצה על בוגרת פותחת את הפרופיל שלה ואת חוות הדעת.</p>
              {groupYears(list).map(([year, inYear]) => (
                <div key={year || "none"} className="mt-3">
                  <h3 className="font-display font-bold text-[14.5px] text-brand-purple border-b-2 border-tint-purple pb-1">
                    {yearLabel(year || null)} <span className="text-ink-400 font-normal">({inYear.length})</span>
                  </h3>
                  {splitByCert ? (
                    [...new Set(inYear.map((g) => g.certificateValue ?? ""))].map((cert) => (
                      <div key={cert || "none"} className="mt-1.5">
                        <div className="text-[11.5px] font-bold text-ink-500 mt-2">
                          {cert ? certLabel(cert) : "ללא תעודה מוגדרת"}
                        </div>
                        {inYear
                          .filter((g) => (g.certificateValue ?? "") === cert)
                          .sort((a, b) => a.full_name.localeCompare(b.full_name, "he"))
                          .map((g) => (
                            <GraduateRow key={g.id} g={g} />
                          ))}
                      </div>
                    ))
                  ) : (
                    inYear
                      .sort((a, b) => a.full_name.localeCompare(b.full_name, "he"))
                      .map((g) => <GraduateRow key={g.id} g={g} />)
                  )}
                </div>
              ))}
              {list.length === 0 && (
                <p className="text-ink-500 text-sm py-2">עוד אין בוגרות מהמוסד הזה בקהילה.</p>
              )}
            </section>
          );
        })}
        {byInstitution.size === 0 && (
          <section className="bg-white border border-ink-200 rounded-[18px] p-6 shadow-sm text-ink-600">
            עוד אין בוגרות מהמוסדות שלך בקהילה — ברגע שיצטרפו, הן יופיעו כאן.
          </section>
        )}

        {/* ─────────────────────────────────────── jobs + her applicants */}
        <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-2">
            <Briefcase size={18} className="text-brand-purple" /> המשרות שלנו וההגשות של הבוגרות שלך
          </h2>
          <p className="text-[12px] text-ink-500 mb-2">מוצגות רק הגשות של בוגרות מהמוסדות שלך.</p>
          <div className="flex flex-col">
            {jobs.map((j) => (
              <div key={j.id} className="py-2.5 border-b border-ink-100 last:border-b-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-ink-900">{j.title}</span>
                  {j.status !== "open" && <Badge variant="gray">נסגרה</Badge>}
                  {j.applicants.length > 0 && (
                    <Badge variant="purple">{j.applicants.length} מהבוגרות שלך</Badge>
                  )}
                </div>
                {j.applicants.length > 0 && (
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
                )}
              </div>
            ))}
            {jobs.length === 0 && <p className="text-ink-500 text-sm py-2">אין כרגע משרות פתוחות.</p>}
          </div>
        </section>

        {/* ──────────────────────────────────────────────── hires */}
        <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-ink-1000 flex items-center gap-2">
            <PartyPopper size={18} className="text-brand-pink-deep" /> גיוסים מהמוסדות שלך ({hires.length})
          </h2>
          <div className="flex flex-col mt-1">
            {hires.map((h, i) => (
              <div key={i} className="py-2 border-b border-ink-100 last:border-b-0 flex items-center gap-3">
                <span className="font-medium text-ink-900">{h.full_name}</span>
                {h.hired_at && (
                  <span className="text-[12px] text-ink-500 tabular-nums">
                    {DATE_HE.format(new Date(h.hired_at))}
                  </span>
                )}
                <span className="ms-auto">🎉</span>
              </div>
            ))}
            {hires.length === 0 && (
              <p className="text-ink-500 text-sm py-2">עוד אין גיוסים רשומים — נעדכן כאן כשיהיו 💜</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
