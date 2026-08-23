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
  /** The job closed/filled since — reflected instead of silence. */
  jobClosed: boolean;
}

export interface MySubmittedItem {
  jobId: string;
  title: string;
  company: string;
  jobClosed: boolean;
}

// Warm member-facing pills, one per pipeline stage.
const STATUS_PILL: Record<ApplicationStatus, { label: string; cls: string }> = {
  draft: { label: "טיוטה", cls: "bg-ink-100 text-ink-700" },
  submitted: { label: "הוגשה 💜", cls: "bg-tint-purple text-brand-purple" },
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
  jobClosed,
}: {
  title: string;
  pill: { label: string; cls: string };
  appliedAt?: string | null;
  jobClosed?: boolean;
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
      </div>
      {jobClosed && (
        <span className="inline-flex items-center px-2.5 py-[3px] rounded-full text-[11px] font-semibold bg-ink-100 text-ink-500">
          המשרה אוישה
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

  const forwarded = visible.filter((a) => a.forwarded && !DONE.includes(a.status));
  const inProgress = visible.filter((a) => !a.forwarded && !DONE.includes(a.status));
  const done = visible.filter((a) => DONE.includes(a.status));

  return (
    <div className="flex flex-col gap-3">
      {inProgress.length > 0 && (
        <Group
          icon={Hourglass}
          title={`אצלנו בבדיקה (${inProgress.length})`}
          hint="הצוות עובר על כל הגשה אישית ובוחר את המתאימות ביותר לכל משרה — לא כל הגשה מועברת ללקוח, וברגע שהמועמדות שלך עוברת תראי את זה כאן."
        >
          {inProgress.map((a) => (
            <Row key={a.jobId} title={a.title} pill={STATUS_PILL[a.status]} appliedAt={a.appliedAt} jobClosed={a.jobClosed} />
          ))}
        </Group>
      )}

      {(forwarded.length > 0 || submitted.length > 0) && (
        <Group
          icon={Send}
          title={`הוגשו ללקוח (${forwarded.length + submitted.length})`}
          hint="קורות החיים שלך אצל המעסיק — נעדכן אותך בכל צעד."
        >
          {forwarded.map((a) => (
            <Row key={a.jobId} title={a.title} pill={STATUS_PILL[a.status]} appliedAt={a.appliedAt} jobClosed={a.jobClosed} />
          ))}
          {submitted.map((s) => (
            <Row
              key={s.jobId}
              title={s.title}
              pill={{ label: "הגשנו אותך ביוזמתנו ✨", cls: "bg-tint-pink text-brand-pink-deep" }}
              jobClosed={s.jobClosed}
            />
          ))}
        </Group>
      )}

      {done.length > 0 && (
        <Group icon={HeartHandshake} title={`הסתיימו (${done.length})`}>
          {done.map((a) => (
            <Row key={a.jobId} title={a.title} pill={STATUS_PILL[a.status]} appliedAt={a.appliedAt} jobClosed={a.jobClosed} />
          ))}
        </Group>
      )}
    </div>
  );
}
