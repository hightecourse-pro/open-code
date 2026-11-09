import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface TargetedJobLite {
  id: string;
  title: string;
  company: string;
  /** Opened within the last week - ״משרה חדשה״; older ones are announced as ״משרה בשבילך״. */
  isNew: boolean;
}

/**
 * A bold brand-gradient banner for jobs published specifically to the current
 * member (job_targets). Server component - the caller queries her targeted
 * open jobs she has not applied to or hidden (the very rule of the ״משרות
 * בשבילך מקוד פתוח״ section on /jobs, so the two never disagree) and passes
 * them in; renders nothing when there are none. Each row links straight to
 * its job - the banner used to send her to the board, where a job she had
 * already applied to was nowhere to be seen (שרי, 2.11: ״מופיע לי שקיימות
 * משרות חדשות, אני נכנסת ואז לא מופיע לי שום משרה״).
 */
export function TargetedJobBanner({ jobs }: { jobs: TargetedJobLite[] }) {
  if (jobs.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-2 bg-brand-gradient text-white rounded-[18px] p-5 shadow-glow-pink"
      data-targeted-banner
    >
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`/jobs/${job.id}/apply`}
          data-targeted-job={job.id}
          data-fresh={job.isNew ? "1" : "0"}
          className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 text-white hover:text-white hover:no-underline transition-[transform,filter] duration-[220ms] hover:-translate-y-0.5 hover:brightness-105"
        >
          <span className="font-display font-bold text-[16px]">
            {/* ״חדשה״ for a week from the opening - the board's ״חדש״ pill keeps the same week (the owner, 19/10). */}
            💼 {job.isNew ? "משרה חדשה מחכה לך" : "משרה בשבילך מקוד פתוח"}: {job.title}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold opacity-90 group-hover:underline">
            לצפייה והגשה <ArrowLeft size={14} />
          </span>
        </Link>
      ))}
    </div>
  );
}
