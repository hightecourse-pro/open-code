import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface TargetedJobLite {
  id: string;
  title: string;
  company: string;
}

/**
 * A bold brand-gradient banner for jobs published specifically to the current
 * member (job_targets). Server component — the caller queries her targeted
 * open jobs and passes them in; renders nothing when there are none.
 */
export function TargetedJobBanner({ jobs }: { jobs: TargetedJobLite[] }) {
  if (jobs.length === 0) return null;

  return (
    <Link
      href="/jobs"
      className="block bg-brand-gradient text-white rounded-[18px] p-5 shadow-glow-pink transition-[transform,filter] duration-[220ms] hover:-translate-y-0.5 hover:brightness-105"
    >
      <div className="flex flex-col gap-1.5">
        {jobs.map((job) => (
          <div key={job.id} className="font-display font-bold text-[16px]">
            💼 משרה חדשה מחכה לך: {job.title}
          </div>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold opacity-90 mt-1">
          לצפייה והגשה <ArrowLeft size={14} />
        </span>
      </div>
    </Link>
  );
}
