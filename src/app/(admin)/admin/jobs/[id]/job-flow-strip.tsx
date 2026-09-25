import Link from "next/link";
import { cn } from "@/lib/utils";

export interface JobFlowInput {
  jobId: string;
  pipelineStatus: string;
  hasClient: boolean;
  applications: number;
  approved: number;
  sentToClient: number;
  interviewing: number;
  hired: number;
  /** The one-click action for the current step, when there is one. */
  action?: React.ReactNode;
}

/**
 * The job's road, in order, with where it stands and what comes next (the
 * owner, 23/9: "כל ה-FLOW של פרסום, סינון, הגשה, גיוס לא ברור"). Six steps,
 * each linking to the tab where that step is done.
 */
export function JobFlowStrip(f: JobFlowInput) {
  const closed = f.pipelineStatus === "hired" || f.pipelineStatus === "hired_direct" || f.pipelineStatus === "closed_no_hire";
  const published = f.pipelineStatus !== "draft";
  // Which step is "now".
  const current = closed
    ? 6
    : f.pipelineStatus === "interviews" || f.interviewing > 0
      ? 5
      : f.pipelineStatus === "candidates_sent" || f.sentToClient > 0
        ? 4
        : !published
          ? 1
          : f.applications === 0
            ? 2
            : 3;

  const steps = [
    { n: 1, label: "פרסום", tab: "publish", value: published ? "פורסמה" : "טיוטה" },
    { n: 2, label: "הגשות", tab: "review", value: `${f.applications}` },
    { n: 3, label: "סינון", tab: "review", value: `${f.approved} אושרו` },
    { n: 4, label: "שליחה ללקוח", tab: "client", value: f.hasClient ? `${f.sentToClient} נשלחו` : "אין לקוח" },
    { n: 5, label: "ראיונות", tab: "review", value: `${f.interviewing}` },
    { n: 6, label: "גיוס", tab: "details", value: closed ? (f.pipelineStatus === "closed_no_hire" ? "נסגרה" : `${f.hired} גויסו`) : `${f.hired}` },
  ];

  const next =
    current === 1
      ? { text: "פרסמי את המשרה לקהל היעד בטאב פרסום.", tab: "publish" }
      : current === 2
        ? { text: "מחכים להגשות. אפשר לאתר מתאימות ולהוסיף אותן ביוזמתך.", tab: "finder" }
        : current === 3
          ? { text: "עברי על המועמדות בטאב מועמדות וסמני 'אישור סופי' למי שמתאימה.", tab: "review" }
          : current === 4
            ? { text: f.sentToClient > 0 ? "המועמדות אצל הלקוח - עדכני ראיון/מבחן כשתשמעי ממנו." : "שלחי את המאושרות ללקוח בטאב לקוח.", tab: "client" }
            : current === 5
              ? { text: "אחרי ראיונות: סמני 'גויסה' על מי שהתקבלה, ואז סגרי את המשרה בטאב פרטי המשרה.", tab: "review" }
              : { text: "המשרה סגורה. אפשר להחזיר אותה לפעילה מטאב פרטי המשרה.", tab: "details" };

  return (
    <div className="bg-white border border-ink-200 rounded-[18px] p-4 shadow-sm">
      <ol className="flex items-stretch gap-1.5 overflow-x-auto">
        {steps.map((s) => {
          const done = s.n < current || (closed && s.n === 6);
          const now = s.n === current && !closed;
          return (
            <li key={s.n} className="flex-1 min-w-[96px]">
              <Link
                href={`/admin/jobs/${f.jobId}?tab=${s.tab}`}
                className={cn(
                  "block rounded-[12px] border px-2.5 py-2 text-center transition-colors h-full",
                  now
                    ? "border-brand-purple bg-tint-purple shadow-[0_0_0_2px_rgba(124,58,237,0.15)]"
                    : done
                      ? "border-[#BFE4D1] bg-tint-mint/50"
                      : "border-ink-200 bg-ink-50 hover:border-brand-purple/40"
                )}
              >
                <div className={cn("text-[10.5px] font-bold", now ? "text-brand-purple" : done ? "text-success" : "text-ink-400")}>
                  {done ? "✓" : s.n} · {s.label}
                </div>
                <div className={cn("font-display text-[14px] font-black leading-tight mt-0.5", now ? "text-ink-1000" : "text-ink-700")}>
                  {s.value}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="text-[12.5px] text-ink-700 mt-2.5">
        <b className="text-brand-purple">הצעד הבא:</b> {next.text}{" "}
        <Link href={`/admin/jobs/${f.jobId}?tab=${next.tab}`} className="font-semibold text-brand-purple hover:underline">
          לשם ←
        </Link>
      </p>
      {f.action}
    </div>
  );
}
