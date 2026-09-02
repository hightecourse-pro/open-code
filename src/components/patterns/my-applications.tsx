import Link from "next/link";
import { HeartHandshake, Hourglass, Send } from "lucide-react";
import type { ApplicationStatus } from "@/types/database";

export interface MyApplicationItem {
  jobId: string;
  title: string;
  company: string;
  status: ApplicationStatus;
  /** When she applied — the PM asked for the date. */
  appliedAt: string | null;
  /** The truth about the client handoff: her CV physically went out. */
  forwarded: boolean;
  /**
   * The job closed since — "המשרה אוישה" when someone was hired, "המשרה
   * נסגרה" otherwise; null while it's open. A closed job's application always
   * files under הסתיימו, whatever its own status says.
   */
  closedLabel: string | null;
  /**
   * The job is still OPEN but moved past submissions (sent to client /
   * interviews). Shown as a chip only — it does NOT end the story (the
   * owner, 31/8: "רק הוגש ללקוח" is not "הסתיימו").
   */
  stageLabel: string | null;
  /** Still editable — the team hasn't locked it (the owner, 2/9). */
  editable?: boolean;
}

export interface MySubmittedItem {
  jobId: string;
  title: string;
  company: string;
  closedLabel: string | null;
  stageLabel: string | null;
}

// Warm member-facing pills, one per pipeline stage.
const STATUS_PILL: Record<ApplicationStatus, { label: string; cls: string }> = {
  draft: { label: "טיוטה", cls: "bg-ink-100 text-ink-700" },
  submitted: { label: "הוגשה לקוד פתוח 💜", cls: "bg-tint-purple text-brand-purple" },
  in_review: { label: "בבדיקה אצלנו 👀", cls: "bg-tint-indigo text-brand-indigo" },
  accepted: { label: "התקבלת! 🎉", cls: "bg-tint-mint text-success" },
  rejected: { label: "לא התקדם הפעם 💪", cls: "bg-ink-100 text-ink-700" },
  sent: { label: "הוגשה ללקוח ✨", cls: "bg-tint-indigo text-brand-indigo" },
  interview: { label: "זומנת לראיון 🎉", cls: "bg-tint-mint text-success" },
  exam: { label: "מבחן 💪", cls: "bg-tint-indigo text-brand-indigo" },
  hired: { label: "גויסת! 🎉", cls: "bg-brand-gradient text-white" },
  declined: { label: "בפעם הבאה 💜", cls: "bg-tint-pink text-brand-pink-deep" },
  waitlisted: { label: "התקדמנו עם מועמדות אחרות 💜", cls: "bg-ink-100 text-ink-700" },
};

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** Statuses that mean this application's story has ended. */
const DONE: ApplicationStatus[] = ["rejected", "declined", "waitlisted", "hired", "accepted"];

function Row({
  title,
  pill,
  appliedAt,
  closedLabel,
  stageLabel,
  editHref,
}: {
  title: string;
  pill: { label: string; cls: string };
  appliedAt?: string | null;
  closedLabel?: string | null;
  stageLabel?: string | null;
  /** When set — the application is still open for edits/withdrawal. */
  editHref?: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-ink-100 last:border-b-0 flex-wrap">
      <div className="flex-1 min-w-[150px]">
        <span className="text-[13.5px] font-semibold text-ink-900">{title}</span>
        {appliedAt && (
          <span className="text-[11.5px] text-ink-400 ms-2" suppressHydrationWarning>
            הוגשה {DATE_HE.format(new Date(appliedAt))}
          </span>
        )}
        {editHref && (
          <Link href={editHref} className="text-[11.5px] font-semibold text-brand-purple hover:underline ms-2">
            עריכה / הסרה ✏️
          </Link>
        )}
      </div>
      {(closedLabel ?? stageLabel) && (
        <span className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-ink-100 text-ink-500">
          {closedLabel ?? stageLabel}
        </span>
      )}
      <span
        className={"inline-flex items-center px-2.5 py-[3px] rounded-full text-[11.5px] font-semibold " + pill.cls}
      >
        {pill.label}
      </span>
    </div>
  );
}

function Group({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Send;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-ink-200 rounded-[16px] p-4 shadow-sm">
      <h3 className="font-display text-[14.5px] font-bold text-ink-1000 flex items-center gap-1.5">
        <Icon size={15} className="text-brand-purple" /> {title}
      </h3>
      {hint && <p className="text-[12px] text-ink-500 mt-0.5">{hint}</p>}
      <div className="flex flex-col mt-1.5">{children}</div>
    </div>
  );
}

/**
 * "ההגשות שלי" — its own view now (the PM's feedback: it must not push the
 * board down). The core separation she asked for is structural: applying to
 * us and being handed to the client are different events, so they are
 * different groups — with an honest line about the gap between them.
 */
export function MyApplications({
  applications,
  submitted,
}: {
  applications: MyApplicationItem[];
  submitted: MySubmittedItem[];
}) {
  const visible = applications.filter((a) => a.status !== "draft");
  if (visible.length === 0 && submitted.length === 0) {
    return (
      <div className="bg-white border border-ink-200 rounded-[16px] p-6 shadow-sm text-ink-700 text-sm">
        עוד לא הגשת מועמדות — ברגע שתגישי, כל הסטטוסים שלך יתרכזו כאן 💜
      </div>
    );
  }

  // A closed job ends the story no matter what the application's own status
  // froze at — leaving it under "בבדיקה" reads as a promise nobody will keep.
  const ended = (a: MyApplicationItem) => DONE.includes(a.status) || !!a.closedLabel;
  const forwarded = visible.filter((a) => a.forwarded && !ended(a));
  const inProgress = visible.filter((a) => !a.forwarded && !ended(a));
  const done = visible.filter(ended);
  const submittedOpen = submitted.filter((s) => !s.closedLabel);
  const submittedClosed = submitted.filter((s) => !!s.closedLabel);
  const proactivePill = { label: "הגשנו אותך ביוזמתנו ✨", cls: "bg-tint-pink text-brand-pink-deep" };

  return (
    <div className="flex flex-col gap-3">
      {inProgress.length > 0 && (
        <Group
          icon={Hourglass}
          title={`אצלנו בבדיקה (${inProgress.length})`}
          hint="הצוות עובר על כל הגשה אישית ובוחר את המתאימות ביותר לכל משרה — לא כל הגשה מועברת ללקוח, וברגע שהמועמדות שלך עוברת תראי את זה כאן."
        >
          {inProgress.map((a) => (
            <Row key={a.jobId} title={a.title} pill={STATUS_PILL[a.status]} appliedAt={a.appliedAt} closedLabel={a.closedLabel} stageLabel={a.stageLabel} editHref={a.editable ? `/jobs/${a.jobId}/apply` : null} />
          ))}
        </Group>
      )}

      {(forwarded.length > 0 || submittedOpen.length > 0) && (
        <Group
          icon={Send}
          title={`הוגשו ללקוח (${forwarded.length + submittedOpen.length})`}
          hint="קורות החיים שלך אצל המעסיק — נעדכן אותך בכל צעד."
        >
          {forwarded.map((a) => (
            <Row key={a.jobId} title={a.title} pill={STATUS_PILL[a.status]} appliedAt={a.appliedAt} closedLabel={a.closedLabel} stageLabel={a.stageLabel} />
          ))}
          {submittedOpen.map((s) => (
            <Row key={s.jobId} title={s.title} pill={proactivePill} closedLabel={s.closedLabel} stageLabel={s.stageLabel} />
          ))}
        </Group>
      )}

      {(done.length > 0 || submittedClosed.length > 0) && (
        <Group icon={HeartHandshake} title={`הסתיימו (${done.length + submittedClosed.length})`}>
          {done.map((a) => (
            <Row key={a.jobId} title={a.title} pill={STATUS_PILL[a.status]} appliedAt={a.appliedAt} closedLabel={a.closedLabel} stageLabel={a.stageLabel} />
          ))}
          {submittedClosed.map((s) => (
            <Row key={s.jobId} title={s.title} pill={proactivePill} closedLabel={s.closedLabel} stageLabel={s.stageLabel} />
          ))}
        </Group>
      )}
    </div>
  );
}
