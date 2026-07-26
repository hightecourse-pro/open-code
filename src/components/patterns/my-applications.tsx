import type { ApplicationStatus } from "@/types/database";

export interface MyApplicationItem {
  jobId: string;
  title: string;
  company: string;
  status: ApplicationStatus;
}

export interface MySubmittedItem {
  jobId: string;
  title: string;
  company: string;
}

// Warm member-facing pills, one per pipeline stage. Legacy statuses
// (in_review/accepted/rejected) keep the wording the job card already uses.
const STATUS_PILL: Record<ApplicationStatus, { label: string; cls: string }> = {
  draft: { label: "טיוטה", cls: "bg-ink-100 text-ink-700" },
  submitted: { label: "הוגשה 💜", cls: "bg-tint-purple text-brand-purple" },
  in_review: { label: "המועמדות שלך בבדיקה 👀", cls: "bg-tint-indigo text-brand-indigo" },
  accepted: { label: "התקבלת! 🎉", cls: "bg-tint-mint text-success" },
  rejected: { label: "הפעם זה לא התקדם — ממשיכות הלאה 💪", cls: "bg-ink-100 text-ink-700" },
  sent: { label: "הגשנו אותך ללקוח ✨", cls: "bg-tint-indigo text-brand-indigo" },
  interview: { label: "זומנת לראיון 🎉", cls: "bg-tint-mint text-success" },
  exam: { label: "מבחן 💪", cls: "bg-tint-indigo text-brand-indigo" },
  hired: { label: "גויסת! 🎉", cls: "bg-brand-gradient text-white" },
  declined: { label: "בפעם הבאה 💜", cls: "bg-tint-pink text-brand-pink-deep" },
};

const SUBMITTED_PILL = { label: "הוגשנו אותך למשרה ✨", cls: "bg-tint-pink text-brand-pink-deep" };

function Row({
  title,
  company,
  pill,
}: {
  title: string;
  company: string;
  pill: { label: string; cls: string };
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
      <div className="flex-1 min-w-[150px]">
        <div className="text-[14px] font-semibold text-ink-900">{title}</div>
        <div className="text-xs text-ink-500">{company}</div>
      </div>
      <span
        className={
          "inline-flex items-center px-3 py-[5px] rounded-full text-xs font-semibold " + pill.cls
        }
      >
        {pill.label}
      </span>
    </div>
  );
}

/**
 * "המשרות שלי" — where each of her applications stands, plus jobs we submitted
 * her to proactively (job_candidates without an application of her own).
 * Server component: the page prepares the arrays; renders nothing when empty.
 */
export function MyApplications({
  applications,
  submitted,
}: {
  applications: MyApplicationItem[];
  submitted: MySubmittedItem[];
}) {
  if (applications.length === 0 && submitted.length === 0) return null;

  return (
    <section className="bg-white border border-ink-200 rounded-[18px] p-5 shadow-sm flex flex-col gap-4">
      <div>
        <h2 className="font-display text-[19px] font-black text-ink-1000">המשרות שלי</h2>
        <p className="text-[13px] text-ink-700">איפה כל מועמדות שלך עומדת — הכול במקום אחד.</p>
      </div>

      {applications.length > 0 && (
        <div>
          <h3 className="font-display text-[14px] font-bold text-ink-900 mb-1">
            משרות שהגשת מועמדות
          </h3>
          <div className="flex flex-col">
            {applications.map((a) => (
              <Row key={a.jobId} title={a.title} company={a.company} pill={STATUS_PILL[a.status]} />
            ))}
          </div>
        </div>
      )}

      {submitted.length > 0 && (
        <div>
          <h3 className="font-display text-[14px] font-bold text-ink-900 mb-1">
            משרות שהגשנו אותך
          </h3>
          <div className="flex flex-col">
            {submitted.map((s) => (
              <Row key={s.jobId} title={s.title} company={s.company} pill={SUBMITTED_PILL} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
