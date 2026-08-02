"use client";

import Link from "next/link";
import { Pencil, Lock, Unlock, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui";
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

const EMP: Record<EmploymentType, string> = {
  full: "משרה מלאה",
  part: "משרה חלקית",
  student: "משרת סטודנטית",
  freelance: "פרילנס",
};

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
 * One job in the admin list. Editing lives on the job page's "פרטי המשרה" tab
 * — the pencil links there; the row keeps the quick actions (lock, delete).
 */
export function AdminJobRow({ job }: { job: AdminJob }) {
  const pipeline = PIPELINE[job.pipeline_status] ?? PIPELINE.draft;
  const kindLabel = KIND_LABEL[job.job_kind] ?? KIND_LABEL.immediate;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-b-0">
      <Badge variant={job.source === "ours" ? "pink" : "tech"}>{job.source === "ours" ? "שלנו" : "שוק"}</Badge>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink-900 truncate">{job.title}</div>
        <div className="text-xs text-ink-500 truncate">
          {job.company} · {EMP[job.employment_type]}
          {job.location ? ` · ${job.location}` : ""}
          {` · ${kindLabel}`}
          {job.job_kind === "practicum_percent" && job.practicum_percent != null
            ? ` (${job.practicum_percent}%)`
            : ""}
        </div>
      </div>
      <Badge variant={pipeline.variant}>{pipeline.label}</Badge>
      <Badge variant={job.status === "open" ? "mint" : "tech"}>{job.status === "open" ? "פתוחה" : "סגורה"}</Badge>
      <Link
        href={`/admin/jobs/${job.id}`}
        className="text-ink-400 hover:text-brand-pink-deep p-1.5"
        title="ניהול מועמדות למשרה"
      >
        <Users size={15} />
      </Link>
      <Link
        href={`/admin/jobs/${job.id}?tab=details`}
        className="text-ink-400 hover:text-brand-purple p-1.5"
        title="עריכת המשרה"
      >
        <Pencil size={15} />
      </Link>
      <form action={setJobStatus.bind(null, job.id, job.status !== "open")}>
        <button type="submit" className="text-ink-400 hover:text-brand-pink-deep p-1.5" title={job.status === "open" ? "סגירת משרה" : "פתיחה מחדש"}>
          {job.status === "open" ? <Lock size={15} /> : <Unlock size={15} />}
        </button>
      </form>
      <form action={deleteJob.bind(null, job.id)}>
        <button type="submit" className="text-ink-400 hover:text-danger p-1.5" title="מחיקה">
          <Trash2 size={15} />
        </button>
      </form>
    </div>
  );
}
