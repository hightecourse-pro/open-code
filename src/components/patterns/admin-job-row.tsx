"use client";

import Link from "next/link";
import { Eye, EyeOff, Pencil, Lock, Unlock, Trash2 } from "lucide-react";
import { Badge, Checkbox } from "@/components/ui";
import { cn } from "@/lib/utils";
import { setJobStatus, setJobVisibility, deleteJob } from "@/app/(admin)/admin/actions";
import { ConfirmActionButton } from "./confirm-action-button";
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
  is_visible?: boolean;
  status: JobStatus;
  client_id: string | null;
  job_kind: JobKind;
  practicum_percent: number | null;
  pipeline_status: JobPipelineStatus;
  created_at?: string;
  published_at?: string | null;
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

// The recruitment-pipeline pill. Tone rules from the PM (2026-08-27): quiet
// grays for drafts and endings — red/pink never marks a normal state; the
// gradient stays for the one genuinely happy ending.
const PIPELINE: Record<
  JobPipelineStatus,
  { label: string; variant: "gray" | "mint" | "indigo" | "warm" | "grad" | "pink" }
> = {
  draft: { label: "לא פורסם", variant: "gray" },
  published: { label: "פורסם", variant: "mint" },
  candidates_sent: { label: "נשלחו מועמדות", variant: "indigo" },
  interviews: { label: "ראיונות", variant: "warm" },
  hired: { label: "גויס", variant: "grad" },
  hired_direct: { label: "גויס ללא פרסום", variant: "mint" },
  closed_no_hire: { label: "נסגר ללא גיוס", variant: "gray" },
};

const DATE_HE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: "Asia/Jerusalem",
});

/** "פתוחה 12 ימים" — from publish (or creation) until now/closing. */
export function daysOpen(j: AdminJob): number | null {
  const from = j.published_at ?? j.created_at;
  if (!from) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000));
}

/** "הגשה אחת", "3 הגשות" — Hebrew that reads like Hebrew. */
export function appsLabel(n: number): string {
  return n === 1 ? "הגשה אחת" : `${n} הגשות`;
}

/**
 * One job in the admin list. The whole main area links to the job's full
 * management page; editing lives on its "פרטי המשרה" tab (the pencil links
 * there) and the row keeps only the quiet quick actions (lock, delete —
 * delete asks first). A job with fresh submissions is visibly highlighted.
 */
export function AdminJobRow({
  job,
  appCounts,
  className,
  selected,
  onSelect,
}: {
  job: AdminJob;
  appCounts?: JobAppCounts;
  className?: string;
  /** Bulk-selection checkbox state — rendered only when onSelect is given. */
  selected?: boolean;
  onSelect?: (on: boolean) => void;
}) {
  const pipeline = PIPELINE[job.pipeline_status] ?? PIPELINE.draft;
  const kindLabel = KIND_LABEL[job.job_kind] ?? KIND_LABEL.immediate;
  const manuallyClosed =
    job.status === "closed" &&
    job.pipeline_status !== "hired" &&
    job.pipeline_status !== "closed_no_hire" &&
    job.pipeline_status !== "draft";
  const fresh = (appCounts?.newCount ?? 0) > 0;
  const open = daysOpen(job);
  const dateFrom = job.published_at ?? job.created_at;

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3 border-b border-ink-100 last:border-b-0",
        fresh && "bg-tint-pink/30 -mx-2 px-2 rounded-lg border border-brand-pink/30",
        className
      )}
    >
      {onSelect && (
        <Checkbox checked={selected ?? false} onChange={(e) => onSelect(e.target.checked)} label="" />
      )}
      <Link
        href={`/admin/jobs/${job.id}`}
        className="flex-1 min-w-0 -mx-2 px-2 -my-1.5 py-1.5 rounded-lg hover:bg-ink-100/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-ink-900 truncate">{job.title}</span>
          <span className="shrink-0 rounded-full px-2 py-px text-[10.5px] font-semibold bg-ink-100 text-ink-500">
            {job.source === "ours" ? "שלנו" : "שוק"}
          </span>
          {job.is_visible === false && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-px text-[10.5px] font-bold bg-ink-900 text-white">
              <EyeOff size={10} /> מוסתרת
            </span>
          )}
        </div>
        <div className="text-xs text-ink-500 truncate mt-0.5">
          {job.company} · {kindLabel}
          {job.job_kind === "practicum_percent" && job.practicum_percent != null
            ? ` (${job.practicum_percent}%)`
            : ""}
          {job.location ? ` · ${job.location}` : ""}
          {dateFrom ? (
            <span className="tabular-nums"> · {job.published_at ? "פורסמה" : "נוצרה"} {DATE_HE.format(new Date(dateFrom))}</span>
          ) : null}
          {job.status === "open" && job.pipeline_status !== "draft" && open != null && (
            <span> · פתוחה {open === 0 ? "מהיום" : open === 1 ? "יום" : `${open} ימים`}</span>
          )}
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

      {/* A draft's next step is publishing — offer it right on the row. */}
      {job.pipeline_status === "draft" && (
        <Link
          href={`/admin/jobs/${job.id}?tab=publish`}
          className="shrink-0 rounded-md bg-brand-gradient px-2.5 py-1 text-[11.5px] font-bold text-white"
        >
          לפרסום ←
        </Link>
      )}

      {appCounts && appCounts.total > 0 && (
        <Link
          href={`/admin/jobs/${job.id}?tab=review`}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors",
            fresh
              ? "border-brand-pink-deep bg-tint-pink text-brand-pink-deep font-semibold"
              : "border-ink-200 text-ink-600 hover:border-brand-pink-deep hover:text-brand-pink-deep"
          )}
        >
          {appsLabel(appCounts.total)}
          {appCounts.newCount > 0 && (
            <span className="font-bold"> · {appCounts.newCount === 1 ? "חדשה" : `${appCounts.newCount} חדשות`}</span>
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
        <form action={setJobVisibility.bind(null, job.id, job.is_visible === false)}>
          <button
            type="submit"
            className="text-ink-300 hover:text-brand-purple p-1.5"
            title={job.is_visible === false ? "הצגה בלוח המשרות" : "הסתרה מלוח המשרות"}
          >
            {job.is_visible === false ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </form>
        <form action={setJobStatus.bind(null, job.id, job.status !== "open")}>
          <button
            type="submit"
            className="text-ink-300 hover:text-brand-pink-deep p-1.5"
            title={job.status === "open" ? "סגירת משרה" : "פתיחה מחדש"}
          >
            {job.status === "open" ? <Lock size={15} /> : <Unlock size={15} />}
          </button>
        </form>
        <ConfirmActionButton
          action={deleteJob.bind(null, job.id)}
          message={`למחוק את המשרה "${job.title}" לצמיתות? כל ההגשות אליה יימחקו איתה. הפעולה אינה ניתנת לביטול.`}
          title="מחיקה"
          className="text-ink-300 hover:text-danger p-1.5"
        >
          <Trash2 size={15} />
        </ConfirmActionButton>
      </div>
    </div>
  );
}
