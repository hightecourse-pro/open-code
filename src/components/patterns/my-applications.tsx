import { CollapsibleSection } from "@/components/patterns/collapsible-section";
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
  waitlisted: { label: "התקדמנו בינתיים עם מועמדות אחרות 💜", cls: "bg-ink-100 text-ink-700" },
};

const SUBMITTED_PILL = { label: "הוגשנו אותך למשרה ✨", cls: "bg-tint-pink text-brand-pink-deep" };

function Row({
  title,
  pill,
}: {
  title: string;
  pill: { label: string; cls: string };
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0 flex-wrap">
      <div className="flex-1 min-w-[150px]">
        <div className="text-[14px] font-semibold text-ink-900">{title}</div>
        {/* Internal jobs never reveal the client — the role stands alone. */}
        <div className="text-xs text-ink-500">משרה דרך קוד פתוח</div>
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
 * The card folds away (and stays folded across visits) so a member with many
 * applications still sees the board itself.
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
    <CollapsibleSection
      title="המשרות שלי"
      subtitle="איפה כל מועמדות שלך עומדת — הכול במקום אחד."
      count={applications.length + submitted.length}
      storageKey="jobs:mine"
    >
      {applications.length > 0 && (
        <div>
          <h3 className="font-display text-[14px] font-bold text-ink-900 mb-1">
            משרות שהגשת מועמדות
          </h3>
          <div className="flex flex-col">
            {applications.map((a) => (
              <Row key={a.jobId} title={a.title} pill={STATUS_PILL[a.status]} />
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
              <Row key={s.jobId} title={s.title} pill={SUBMITTED_PILL} />
            ))}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}
