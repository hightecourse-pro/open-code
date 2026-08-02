"use client";

import Link from "next/link";
import { Pencil, Lock, Unlock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { setJobStatus, deleteJob } from "@/app/(admin)/admin/actions";
import type {
  EmploymentType,
  JobKind,
  JobPipelineStatus,
  JobSource,
  JobStatus,
} from "@/types/database";

export interface AdminJob {
  id: string;
  company: string;
  title: string;
  source: JobSource;
  employment_type: EmploymentType;
  location: string | null;
  tech_tags: string[];
  external_url: string | null;
  description: string;
  description_html: string | null;
  status: JobStatus;
  client_id: string | null;
  job_kind: JobKind;
  practicum_percent: number | null;
  pipeline_status: JobPipelineStatus;
  created_at?: string;
}

export interface PortalClientOption {
  id: string;
  company_name: string;
}

/** Per-job application counts, computed on the server page. */
export interface JobAppCounts {
  total: number;
  newCount: number;
}

/** Shared job-kind labels (create form + edit form + row). */
export const JOB_KIND_OPTIONS: { value: JobKind; label: string }[] = [
  { value: "immediate", label: "גיוס מיידי" },
  { value: "practicum_placement", label: "פרקטיקום 3 חודשים עם השמה בקצה" },
  { value: "practicum_percent", label: "פרקטיקום עם % גיוס" },
  { value: "practicum_free", label: "פרקטיקום ללא התחייבות" },
  { value: "other", label: "אחר" },
];

const KIND_LABEL = Object.fromEntries(JOB_KIND_OPTIONS.map((k) => [k.value, k.label])) as Record<
  JobKind,
  string
>;

// The recruitment-pipeline pill. The status itself is changed from the job's
// detail page — here it is display-only.
const PIPELINE: Record<
  JobPipelineStatus,
  { label: string; variant: "tech" | "mint" | "indigo" | "warm" | "grad" | "pink" }
> = {
  draft: { label: "לא פורסם", variant: "tech" },
  published: { label: "פורסם", variant: "mint" },
  candidates_sent: { label: "נשלחו מועמדות", variant: "indigo" },
  interviews: { label: "ראיונות", variant: "warm" },
  hired: { label: "גויס", variant: "grad" },
  closed_no_hire: { label: "נסגר ללא גיוס", variant: "pink" },
};

/**
 * One job in the admin list. The whole main area links to the job's full
 * management page; editing lives on its "פרטי המשרה" tab (the pencil links
 * there) and the row keeps only the quiet quick actions (lock, delete).
 */
export function AdminJobRow({
  job,
  appCounts,
  className,
}: {
  job: AdminJob;
  appCounts?: JobAppCounts;
  className?: string;
}) {
  const pipeline = PIPELINE[job.pipeline_status] ?? PIPELINE.draft;
  const kindLabel = KIND_LABEL[job.job_kind] ?? KIND_LABEL.immediate;
  // Manually closed while the pipeline is still in play — flag it inside the pill.
  const manuallyClosed =
    job.status === "closed" &&
    job.pipeline_status !== "hired" &&
    job.pipeline_status !== "closed_no_hire" &&
    job.pipeline_status !== "draft";

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3 border-b border-ink-100 last:border-b-0",
        className
      )}
    >
      <Link
        href={`/admin/jobs/${job.id}`}
        className="flex-1 min-w-0 -mx-2 px-2 -my-1.5 py-1.5 rounded-lg hover:bg-ink-100/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-ink-900 truncate">{job.title}</span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-px text-[10.5px] font-semibold",
              job.source === "ours"
                ? "bg-tint-pink text-brand-pink-deep"
                : "bg-ink-100 text-ink-500"
            )}
          >
            {job.source === "ours" ? "שלנו" : "שוק"}
          </span>
        </div>
        <div className="text-xs text-ink-500 truncate mt-0.5">
          {job.company} · {kindLabel}
          {job.job_kind === "practicum_percent" && job.practicum_percent != null
            ? ` (${job.practicum_percent}%)`
            : ""}
          {job.location ? ` · ${job.location}` : ""}
        </div>
      </Link>

      <Badge variant={pipeline.variant} className="shrink-0">
        {pipeline.label}
        {manuallyClosed && (
          <span title="סגורה ידנית" className="inline-flex">
            <Lock size={11} aria-hidden />
          </span>
        )}
      </Badge>

      {appCounts && appCounts.total > 0 && (
        <Link
          href={`/admin/jobs/${job.id}?tab=review`}
          className="shrink-0 rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:border-brand-pink-deep hover:text-brand-pink-deep transition-colors"
        >
          {appCounts.total} הגשות
          {appCounts.newCount > 0 && (
            <span className="font-semibold text-brand-pink-deep">
              {" "}
              · {appCounts.newCount} חדשות
            </span>
          )}
        </Link>
      )}

      <div className="flex items-center shrink-0">
        <Link
          href={`/admin/jobs/${job.id}?tab=details`}
          className="text-ink-300 hover:text-brand-purple p-1.5"
          title="עריכת המשרה"
        >
          <Pencil size={15} />
        </Link>
        <form action={setJobStatus.bind(null, job.id, job.status !== "open")}>
          <button
            type="submit"
            className="text-ink-300 hover:text-brand-pink-deep p-1.5"
            title={job.status === "open" ? "סגירת משרה" : "פתיחה מחדש"}
          >
            {job.status === "open" ? <Lock size={15} /> : <Unlock size={15} />}
          </button>
        </form>
        <form action={deleteJob.bind(null, job.id)}>
          <button type="submit" className="text-ink-300 hover:text-danger p-1.5" title="מחיקה">
            <Trash2 size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
